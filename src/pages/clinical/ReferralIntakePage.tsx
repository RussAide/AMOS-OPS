import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  ArrowRightLeft, Search, Plus, Filter, X, Clock, CheckCircle,
  AlertTriangle, User, Building, ArrowRight, Ban, FileText
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706", accepted: "#2563EB", assigned: "#7C3AED",
  in_progress: "#059669", completed: "#059669", declined: "#DC2626",
  cancelled: "#6B7280", no_show: "#DC2626",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", accepted: "Accepted", assigned: "Assigned",
  in_progress: "In Progress", completed: "Completed", declined: "Declined",
  cancelled: "Cancelled", no_show: "No Show",
};
const URGENCY_COLORS: Record<string, string> = {
  routine: "#059669", urgent: "#D97706", emergency: "#DC2626",
};
const DEPT_OPTIONS = ["CCMG", "MHTCM", "MHRS", "GRO"] as const;
const TYPE_OPTIONS = ["internal", "external", "gro_to_bhc", "bhc_to_gro", "inter_department"] as const;

export function ReferralIntakePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);

  const { data: referrals, isLoading } = trpc.bhc.listReferrals.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const utils = trpc.useUtils();

  const createReferral = trpc.bhc.createReferral.useMutation({
    onSuccess: () => { utils.bhc.listReferrals.invalidate(); setShowCreate(false); },
  });
  const acceptReferral = trpc.bhc.acceptReferral.useMutation({
    onSuccess: () => { utils.bhc.listReferrals.invalidate(); setSelectedReferralId(null); },
  });
  const completeReferral = trpc.bhc.completeReferral.useMutation({
    onSuccess: () => { utils.bhc.listReferrals.invalidate(); setSelectedReferralId(null); },
  });
  const declineReferral = trpc.bhc.declineReferral.useMutation({
    onSuccess: () => { utils.bhc.listReferrals.invalidate(); setSelectedReferralId(null); },
  });

  const [form, setForm] = useState({
    youthId: "", youthName: "", mrn: "",
    referralType: "internal" as typeof TYPE_OPTIONS[number],
    fromDepartment: "GRO" as typeof DEPT_OPTIONS[number],
    toDepartment: "CCMG" as typeof DEPT_OPTIONS[number],
    requestedBy: "", reasonForReferral: "", clinicalJustification: "", urgency: "routine" as "routine" | "urgent" | "emergency",
  });

  const statuses = ["all", "pending", "accepted", "assigned", "in_progress", "completed", "declined"];

  const filteredReferrals = (referrals ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.youthName.toLowerCase().includes(q) || r.reasonForReferral.toLowerCase().includes(q) || r.mrn.toLowerCase().includes(q);
  });

  const { data: selectedReferral } = trpc.bhc.getReferral.useQuery(
    { id: selectedReferralId ?? "" }, { enabled: !!selectedReferralId }
  );

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Referral Intake</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            {filteredReferrals.length} referrals — {referrals?.filter((r) => r.status === "pending").length ?? 0} pending
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}>
          <Plus size={16} /> New Referral
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search by youth name, MRN, reason..."
            className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <X size={14} className="cursor-pointer" onClick={() => setSearch("")} style={{ color: "var(--topbar-subtitle)" }} />}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={14} style={{ color: "var(--topbar-subtitle)" }} />
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
              style={{
                backgroundColor: statusFilter === s ? "#245C5A" : "var(--card-bg)",
                color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)",
                border: `1px solid ${statusFilter === s ? "#245C5A" : "var(--card-border)"}`,
              }}>
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals List */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading referrals...</p>
      ) : filteredReferrals.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <ArrowRightLeft size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No referrals found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReferrals.map((r) => (
            <div key={r.id}
              className="rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              onClick={() => setSelectedReferralId(r.id)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{r.youthName}</span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{r.mrn}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: (STATUS_COLORS[r.status] ?? "#6B7280") + "15", color: STATUS_COLORS[r.status] }}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: (URGENCY_COLORS[r.urgency] ?? "#6B7280") + "15", color: URGENCY_COLORS[r.urgency] ?? "#6B7280" }}>
                    {r.urgency === "emergency" && <AlertTriangle size={10} className="inline mr-1" />}
                    {r.urgency}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                <span className="flex items-center gap-1"><Building size={12} /> {r.fromDepartment}</span>
                <ArrowRight size={12} />
                <span className="flex items-center gap-1">{r.toDepartment}</span>
                <span className="mx-1">|</span>
                <span>{r.referralType.replace(/_/g, " ")}</span>
              </div>
              <p className="text-[13px] font-medium mb-1" style={{ color: "var(--topbar-title)" }}>{r.reasonForReferral}</p>
              {r.clinicalJustification && (
                <p className="text-[12px] line-clamp-2" style={{ color: "var(--topbar-subtitle)" }}>{r.clinicalJustification}</p>
              )}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); acceptReferral.mutate({ id: r.id, acceptedBy: "current-user" }); }}
                    className="px-3 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700">
                    Accept
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); declineReferral.mutate({ id: r.id, reason: "Not appropriate for this service" }); }}
                    className="px-3 py-1 rounded-md text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100">
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <ArrowRightLeft size={18} style={{ color: "#245C5A" }} /> New Referral
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Select Youth</label>
                <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mt-1" style={{ borderColor: "var(--card-border)" }}
                  onChange={(e) => {
                    const p = patientsData?.patients.find((pp) => pp.id === e.target.value);
                    if (p) setForm({ ...form, youthId: p.id, youthName: `${p.firstName} ${p.lastName}`, mrn: p.mrn });
                  }}>
                  <option value="">Select patient...</option>
                  {(patientsData?.patients ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} — {p.mrn}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>From</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mt-1" style={{ borderColor: "var(--card-border)" }}
                    value={form.fromDepartment} onChange={(e) => setForm({ ...form, fromDepartment: e.target.value as typeof DEPT_OPTIONS[number] })}>
                    {DEPT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>To</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mt-1" style={{ borderColor: "var(--card-border)" }}
                    value={form.toDepartment} onChange={(e) => setForm({ ...form, toDepartment: e.target.value as typeof DEPT_OPTIONS[number] })}>
                    {DEPT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Type</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mt-1" style={{ borderColor: "var(--card-border)" }}
                    value={form.referralType} onChange={(e) => setForm({ ...form, referralType: e.target.value as typeof TYPE_OPTIONS[number] })}>
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Urgency</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mt-1" style={{ borderColor: "var(--card-border)" }}
                    value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as any })}>
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <input placeholder="Requested By *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })} />
              <textarea placeholder="Reason for Referral *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-16 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.reasonForReferral} onChange={(e) => setForm({ ...form, reasonForReferral: e.target.value })} />
              <textarea placeholder="Clinical Justification" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-16 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.clinicalJustification} onChange={(e) => setForm({ ...form, clinicalJustification: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!form.youthId || !form.requestedBy || !form.reasonForReferral) return;
                createReferral.mutate({ ...form });
              }} disabled={createReferral.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createReferral.isPending ? "Submitting..." : "Submit Referral"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReferralId && selectedReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedReferralId(null)}>
          <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>Referral Detail</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: (STATUS_COLORS[selectedReferral.status] ?? "#6B7280") + "15", color: STATUS_COLORS[selectedReferral.status] }}>
                  {STATUS_LABELS[selectedReferral.status]}
                </span>
              </div>
              <X size={18} className="cursor-pointer" onClick={() => setSelectedReferralId(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedReferral.youthName}</p>
                  <p className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{selectedReferral.mrn}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Route</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedReferral.fromDepartment} → {selectedReferral.toDepartment}</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{selectedReferral.referralType.replace(/_/g, " ")}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Reason</p>
                <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{selectedReferral.reasonForReferral}</p>
              </div>

              {selectedReferral.clinicalJustification && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Clinical Justification</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{selectedReferral.clinicalJustification}</p>
                </div>
              )}

              {selectedReferral.outcomeNotes && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Outcome</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{selectedReferral.outcomeNotes}</p>
                </div>
              )}

              {selectedReferral.acceptedBy && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <CheckCircle size={14} style={{ color: "#059669" }} />
                  <span>Accepted by {selectedReferral.acceptedBy} on {selectedReferral.acceptedAt ? new Date(selectedReferral.acceptedAt).toLocaleDateString() : "—"}</span>
                </div>
              )}

              {/* Actions */}
              {selectedReferral.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => acceptReferral.mutate({ id: selectedReferral.id, acceptedBy: "current-user" })}
                    className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2">
                    <CheckCircle size={14} /> Accept
                  </button>
                  <button onClick={() => { const reason = prompt("Reason for declining?"); if (reason) declineReferral.mutate({ id: selectedReferral.id, reason }); }}
                    className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-red-700 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2">
                    <Ban size={14} /> Decline
                  </button>
                </div>
              )}
              {selectedReferral.status === "accepted" && (
                <button onClick={() => { const notes = prompt("Outcome notes?"); if (notes) completeReferral.mutate({ id: selectedReferral.id, outcomeNotes: notes }); }}
                  className="w-full px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2">
                  <CheckCircle size={14} /> Complete Referral
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReferralIntakePage;
