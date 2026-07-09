import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Shield, Search, Plus, Edit3, Trash2, X, Check, AlertCircle,
  Building2, FileBadge
} from "lucide-react";

export function InsurancePlansPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: plans, isLoading } = trpc.bhc.listInsurancePlans.useQuery();
  const utils = trpc.useUtils();

  const createPlan = trpc.bhc.createInsurancePlan.useMutation({
    onSuccess: () => { utils.bhc.listInsurancePlans.invalidate(); setShowCreate(false); },
  });
  const updatePlan = trpc.bhc.updateInsurancePlan.useMutation({
    onSuccess: () => { utils.bhc.listInsurancePlans.invalidate(); setEditingId(null); },
  });
  const deletePlan = trpc.bhc.deleteInsurancePlan.useMutation({
    onSuccess: () => utils.bhc.listInsurancePlans.invalidate(),
  });

  const [createForm, setCreateForm] = useState({ payerName: "", planName: "", policyNumberPattern: "" });
  const [editForm, setEditForm] = useState({ payerName: "", planName: "", policyNumberPattern: "", isActive: true });

  const filteredPlans = (plans ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.payerName.toLowerCase().includes(q) || p.planName.toLowerCase().includes(q);
  });

  const startEdit = (plan: NonNullable<typeof plans>[number]) => {
    setEditForm({ payerName: plan.payerName, planName: plan.planName, policyNumberPattern: plan.policyNumberPattern ?? "", isActive: plan.isActive ?? true });
    setEditingId(plan.id);
  };

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Insurance Plans</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredPlans.length} plans configured</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}>
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mb-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
        <input type="text" placeholder="Search by payer or plan name..."
          className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <X size={14} className="cursor-pointer" onClick={() => setSearch("")} style={{ color: "var(--topbar-subtitle)" }} />}
      </div>

      {/* Plans Table */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading plans...</p>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Shield size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No insurance plans found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--header-bg, #F0FDFA)" }}>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Payer</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Plan Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Policy Pattern</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr key={plan.id} className="border-t transition-colors" style={{ borderColor: "var(--card-border)" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--hover-bg, rgba(36,92,90,0.03))"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                  {editingId === plan.id ? (
                    <>
                      <td className="px-4 py-3"><input className="w-full rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                        value={editForm.payerName} onChange={(e) => setEditForm({ ...editForm, payerName: e.target.value })} /></td>
                      <td className="px-4 py-3"><input className="w-full rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                        value={editForm.planName} onChange={(e) => setEditForm({ ...editForm, planName: e.target.value })} /></td>
                      <td className="px-4 py-3"><input className="w-full rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                        value={editForm.policyNumberPattern} onChange={(e) => setEditForm({ ...editForm, policyNumberPattern: e.target.value })} /></td>
                      <td className="px-4 py-3 text-center">
                        <select className="rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                          value={editForm.isActive ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => updatePlan.mutate({ id: plan.id, ...editForm })}
                          className="p-1 rounded text-green-600 hover:bg-green-50 mr-1"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 rounded text-red-600 hover:bg-red-50"><X size={14} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} style={{ color: "#245C5A" }} />
                          <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{plan.payerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: "var(--topbar-title)" }}>{plan.planName}</td>
                      <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{plan.policyNumberPattern ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${plan.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(plan)}
                          className="p-1.5 rounded-md text-[#245C5A] hover:bg-[#245C5A10] mr-1" title="Edit"><Edit3 size={13} /></button>
                        <button onClick={() => { if (confirm("Delete this plan?")) deletePlan.mutate({ id: plan.id }); }}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={13} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl border p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Shield size={18} style={{ color: "#245C5A" }} /> Add Insurance Plan
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <input placeholder="Payer Name *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={createForm.payerName} onChange={(e) => setCreateForm({ ...createForm, payerName: e.target.value })} />
              <input placeholder="Plan Name *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={createForm.planName} onChange={(e) => setCreateForm({ ...createForm, planName: e.target.value })} />
              <input placeholder="Policy Number Pattern (regex)" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={createForm.policyNumberPattern} onChange={(e) => setCreateForm({ ...createForm, policyNumberPattern: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!createForm.payerName || !createForm.planName) return;
                createPlan.mutate({ payerName: createForm.payerName, planName: createForm.planName, policyNumberPattern: createForm.policyNumberPattern || undefined });
              }} disabled={createPlan.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createPlan.isPending ? "Adding..." : "Add Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InsurancePlansPage;
