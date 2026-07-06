import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Search, Plus, Filter, ChevronLeft, ChevronRight,
  CheckCircle, Clock, AlertTriangle, X, FileText, User
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", active: "#059669", under_review: "#D97706",
  completed: "#2563EB", discontinued: "#DC2626",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", active: "Active", under_review: "Under Review",
  completed: "Completed", discontinued: "Discontinued",
};

export function TreatmentPlansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plansData, isLoading } = trpc.bhc.listTreatmentPlans.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const utils = trpc.useUtils();

  const createPlan = trpc.bhc.createTreatmentPlan.useMutation({
    onSuccess: () => { utils.bhc.listTreatmentPlans.invalidate(); setShowCreate(false); },
  });
  const approvePlan = trpc.bhc.approveTreatmentPlan.useMutation({
    onSuccess: () => utils.bhc.listTreatmentPlans.invalidate(),
  });

  const [form, setForm] = useState({
    patientId: "", primaryDiagnosis: "", secondaryDiagnosis: "",
    presentingProblem: "", goals: [{ description: "", targetDate: "" }],
    interventions: [{ type: "", description: "", frequency: "" }],
    estimatedDurationWeeks: "", startDate: "", reviewDate: "",
    assignedClinicianId: "", supervisorId: "",
  });

  const statuses = ["all", "draft", "active", "under_review", "completed", "discontinued"];

  const filteredPlans = (plansData ?? []).filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.planNumber.toLowerCase().includes(s) ||
      p.primaryDiagnosis.toLowerCase().includes(s) ||
      p.presentingProblem.toLowerCase().includes(s)
    );
  });

  const { data: selectedPlan } = trpc.bhc.getTreatmentPlan.useQuery(
    { id: selectedPlanId ?? "" },
    { enabled: !!selectedPlanId }
  );

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Treatment Plans</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            {filteredPlans.length} plans in system
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}
        >
          <Plus size={16} /> New Plan
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search by plan number, diagnosis..."
            className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <X size={14} className="cursor-pointer" onClick={() => setSearch("")} style={{ color: "var(--topbar-subtitle)" }} />}
        </div>
        <div className="flex items-center gap-1">
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

      {/* Plans List */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading plans...</p>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <BookOpen size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No treatment plans found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlans.map((plan) => (
            <div key={plan.id}
              className="rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              onClick={() => setSelectedPlanId(plan.id)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: "#245C5A" }}>{plan.planNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: (STATUS_COLORS[plan.status] ?? "#6B7280") + "15", color: STATUS_COLORS[plan.status] }}>
                    {STATUS_LABELS[plan.status] ?? plan.status}
                  </span>
                  {plan.status === "under_review" && (
                    <button onClick={(e) => { e.stopPropagation(); approvePlan.mutate({ id: plan.id, approvedBy: "current-user" }); }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-green-600 hover:bg-green-700">
                      Approve
                    </button>
                  )}
                </div>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : "—"} → {plan.reviewDate ? new Date(plan.reviewDate).toLocaleDateString() : "—"}
                </span>
              </div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>{plan.primaryDiagnosis}</p>
              <p className="text-[12px] line-clamp-2 mb-2" style={{ color: "var(--topbar-subtitle)" }}>{plan.presentingProblem}</p>
              <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                <span className="flex items-center gap-1"><User size={12} /> {plan.assignedClinicianId?.slice(0, 8) ?? "—"}</span>
                {plan.estimatedDurationWeeks && <span className="flex items-center gap-1"><Clock size={12} /> {plan.estimatedDurationWeeks} weeks</span>}
                {plan.goalsJson && <span className="flex items-center gap-1"><CheckCircle size={12} /> {JSON.parse(plan.goalsJson).length} goals</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl border p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <BookOpen size={18} style={{ color: "#245C5A" }} /> New Treatment Plan
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                <option value="">Select Patient...</option>
                {(patientsData?.patients ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} — {p.mrn}</option>
                ))}
              </select>
              <input placeholder="Primary Diagnosis *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.primaryDiagnosis} onChange={(e) => setForm({ ...form, primaryDiagnosis: e.target.value })} />
              <input placeholder="Secondary Diagnosis" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.secondaryDiagnosis} onChange={(e) => setForm({ ...form, secondaryDiagnosis: e.target.value })} />
              <textarea placeholder="Presenting Problem *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-20 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.presentingProblem} onChange={(e) => setForm({ ...form, presentingProblem: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <input type="date" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Assigned Clinician ID *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.assignedClinicianId} onChange={(e) => setForm({ ...form, assignedClinicianId: e.target.value })} />
                <input type="number" placeholder="Duration (weeks)" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.estimatedDurationWeeks} onChange={(e) => setForm({ ...form, estimatedDurationWeeks: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Goals</label>
                {form.goals.map((g, i) => (
                  <div key={i} className="flex gap-2 mt-1">
                    <input placeholder="Goal description" className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={g.description} onChange={(e) => { const goals = [...form.goals]; goals[i].description = e.target.value; setForm({ ...form, goals }); }} />
                    <input type="date" className="w-32 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={g.targetDate} onChange={(e) => { const goals = [...form.goals]; goals[i].targetDate = e.target.value; setForm({ ...form, goals }); }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Interventions</label>
                {form.interventions.map((inv, i) => (
                  <div key={i} className="flex gap-2 mt-1">
                    <input placeholder="Type" className="w-24 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={inv.type} onChange={(e) => { const iv = [...form.interventions]; iv[i].type = e.target.value; setForm({ ...form, interventions: iv }); }} />
                    <input placeholder="Description" className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={inv.description} onChange={(e) => { const iv = [...form.interventions]; iv[i].description = e.target.value; setForm({ ...form, interventions: iv }); }} />
                    <input placeholder="Frequency" className="w-28 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={inv.frequency} onChange={(e) => { const iv = [...form.interventions]; iv[i].frequency = e.target.value; setForm({ ...form, interventions: iv }); }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!form.patientId || !form.primaryDiagnosis || !form.presentingProblem || !form.startDate || !form.reviewDate || !form.assignedClinicianId) return;
                createPlan.mutate({
                  patientId: form.patientId, primaryDiagnosis: form.primaryDiagnosis,
                  secondaryDiagnosis: form.secondaryDiagnosis || undefined, presentingProblem: form.presentingProblem,
                  goals: form.goals.filter(g => g.description), interventions: form.interventions.filter(i => i.description),
                  estimatedDurationWeeks: form.estimatedDurationWeeks ? parseInt(form.estimatedDurationWeeks) : undefined,
                  startDate: form.startDate, reviewDate: form.reviewDate,
                  assignedClinicianId: form.assignedClinicianId, supervisorId: form.supervisorId || undefined,
                });
              }} disabled={createPlan.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createPlan.isPending ? "Creating..." : "Create Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Detail Modal */}
      {selectedPlanId && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedPlanId(null)}>
          <div className="rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedPlan.planNumber}</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: (STATUS_COLORS[selectedPlan.status] ?? "#6B7280") + "15", color: STATUS_COLORS[selectedPlan.status] }}>
                  {STATUS_LABELS[selectedPlan.status]}
                </span>
              </div>
              <X size={18} className="cursor-pointer" onClick={() => setSelectedPlanId(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Primary Diagnosis</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedPlan.primaryDiagnosis}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Presenting Problem</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{selectedPlan.presentingProblem}</p>
                </div>
              </div>

              {selectedPlan.goalsJson && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--topbar-subtitle)" }}>Treatment Goals</p>
                  <div className="space-y-1">
                    {JSON.parse(selectedPlan.goalsJson).map((g: { description: string; targetDate?: string }, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-[12px]">
                        <CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                        <span style={{ color: "var(--topbar-title)" }}>{g.description} {g.targetDate && <span style={{ color: "var(--topbar-subtitle)" }}>({new Date(g.targetDate).toLocaleDateString()})</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlan.interventionsJson && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--topbar-subtitle)" }}>Interventions</p>
                  <div className="space-y-1">
                    {JSON.parse(selectedPlan.interventionsJson).map((inv: { type: string; description: string; frequency: string }, i: number) => (
                      <div key={i} className="text-[12px]" style={{ color: "var(--topbar-title)" }}>
                        <span className="font-medium">{inv.type}:</span> {inv.description} <span style={{ color: "var(--topbar-subtitle)" }}>({inv.frequency})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlan.sessions && selectedPlan.sessions.length > 0 && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--topbar-subtitle)" }}>Linked Sessions ({selectedPlan.sessions.length})</p>
                  <div className="space-y-1">
                    {selectedPlan.sessions.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-[12px]">
                        <FileText size={12} style={{ color: "#245C5A" }} />
                        <span style={{ color: "var(--topbar-title)" }}>{new Date(s.sessionDate).toLocaleDateString()} — {s.sessionType ?? "Session"} ({s.durationMinutes} min)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                <span><strong>Start:</strong> {selectedPlan.startDate ? new Date(selectedPlan.startDate).toLocaleDateString() : "—"}</span>
                <span><strong>Review:</strong> {selectedPlan.reviewDate ? new Date(selectedPlan.reviewDate).toLocaleDateString() : "—"}</span>
                {selectedPlan.estimatedDurationWeeks && <span><strong>Duration:</strong> {selectedPlan.estimatedDurationWeeks} weeks</span>}
                {selectedPlan.approvedBy && <span><strong>Approved by:</strong> {selectedPlan.approvedBy}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreatmentPlansPage;
