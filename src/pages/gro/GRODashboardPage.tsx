import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { TrendingUp, Users, Handshake, Target, Megaphone, ArrowRight, Plus, X } from "lucide-react";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  new: "#2563EB", in_review: "#D97706", active: "#059669",
  converted: "#7C3AED", deferred: "#6B7280", closed: "#94A3B8",
};

const TYPE_COLORS: Record<string, string> = {
  intake: "#059669", crisis: "#DC2626", adolescent: "#2563EB",
  mandatory: "#D97706", educational: "#7C3AED", community: "#245C5A",
};

export function GRODashboardPage() {
  const { data: kpis } = trpc.gro.dashboardKPIs.useQuery();
  const { data: referrals } = trpc.gro.listReferrals.useQuery();
  const { data: partnerships } = trpc.gro.listPartnerships.useQuery();
  const { data: campaigns } = trpc.gro.listCampaigns.useQuery();
  const utils = trpc.useUtils();
  const createRef = trpc.gro.createReferral.useMutation({ onSuccess: () => { utils.gro.listReferrals.invalidate(); utils.gro.dashboardKPIs.invalidate(); setShowNew(false); } });

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientName: "", contactPhone: "", contactEmail: "", referralSource: "", sourceDetail: "", referralType: "", assignedTo: "", notes: "" });

  const kpiCards = [
    { label: "Active Referrals", value: kpis?.activeReferrals ?? 0, icon: Users, color: "#2563EB" },
    { label: "Partnerships", value: kpis?.activePartnerships ?? 0, icon: Handshake, color: "#059669" },
    { label: "Conversion Rate", value: `${kpis?.conversionRate ?? 0}%`, icon: Target, color: "#D97706" },
    { label: "New This Month", value: kpis?.newThisMonth ?? 0, icon: TrendingUp, color: "#245C5A" },
  ];

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Growth & Outreach</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Referral Management, Partnerships & Community Engagement</p>
          </div>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={16} /> New Referral
          </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Referrals */}
          <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={18} style={{ color: "#2563EB" }} /> Referrals ({referrals?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {(!referrals || referrals.length === 0) && <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>No referrals found</p>}
              {referrals?.map((ref: any) => (
                <div key={ref.id} className="flex items-start justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{ref.referral_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[ref.status] ?? "#6B7280") + "15", color: STATUS_COLORS[ref.status] ?? "#6B7280" }}>{ref.status}</span>
                      {ref.referral_type && <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: (TYPE_COLORS[ref.referral_type] ?? "#6B7280") + "10", color: TYPE_COLORS[ref.referral_type] ?? "#6B7280" }}>{ref.referral_type}</span>}
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{ref.patient_name}</p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{ref.referral_source} {ref.source_detail ? `— ${ref.source_detail}` : ""}</p>
                    {ref.notes && <p className="text-[11px] mt-1 italic" style={{ color: "var(--topbar-subtitle)" }}>{ref.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {ref.assigned_to && <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{ref.assigned_to}</p>}
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{new Date(ref.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partnerships */}
          <div>
            <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Handshake size={18} style={{ color: "#059669" }} /> Partnerships
              </h2>
              <div className="space-y-3">
                {(!partnerships || partnerships.length === 0) && <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No partnerships</p>}
                {partnerships?.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{p.organization_name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: p.status === "active" ? "#D1FAE5" : "#FEF3C7", color: p.status === "active" ? "#059669" : "#D97706" }}>{p.status}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{p.partnership_type}</p>
                    {p.contact_name && <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{p.contact_name}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Megaphone size={18} style={{ color: "#245C5A" }} /> Active Campaigns
              </h2>
              <div className="space-y-3">
                {(!campaigns || campaigns.length === 0) && <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No campaigns</p>}
                {campaigns?.map((c: any) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.campaign_name}</p>
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{c.leads_generated} leads</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((c.conversions / Math.max(c.leads_generated, 1)) * 100, 100)}%`, backgroundColor: "#245C5A" }} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.conversions} conversions</span>
                      <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{Math.round((c.conversions / Math.max(c.leads_generated, 1)) * 100)}% rate</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Referral Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNew(false)}>
          <div className="rounded-xl border p-6 w-full max-w-md" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>New Referral</h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowNew(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <input placeholder="Patient Name *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Phone" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                <input placeholder="Email" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <input placeholder="Referral Source *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.referralSource} onChange={(e) => setForm({ ...form, referralSource: e.target.value })} />
              <input placeholder="Source Detail" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.sourceDetail} onChange={(e) => setForm({ ...form, sourceDetail: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Referral Type" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.referralType} onChange={(e) => setForm({ ...form, referralType: e.target.value })} />
                <input placeholder="Assigned To" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
              </div>
              <textarea placeholder="Notes" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-20 resize-none" style={{ borderColor: "var(--card-border)" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => { if (!form.patientName || !form.referralSource) return; createRef.mutate(form); }} disabled={createRef.isPending} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createRef.isPending ? "Creating..." : "Create Referral"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
