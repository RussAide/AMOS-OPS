import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  FileText, Search, Plus, Filter, Calendar, User, ShieldAlert, Clock, X,
  Stethoscope
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#2563EB", in_progress: "#D97706", completed: "#059669",
  cancelled: "#6B7280", no_show: "#DC2626",
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed",
  cancelled: "Cancelled", no_show: "No Show",
};
const SESSION_TYPES = ["individual", "group", "family", "couples", "intake", "crisis", "telehealth"] as const;

export function ClinicalSessionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessionsData, isLoading } = trpc.bhc.listSessions.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const utils = trpc.useUtils();

  const createSession = trpc.bhc.createSession.useMutation({
    onSuccess: () => { utils.bhc.listSessions.invalidate(); setShowCreate(false); },
  });

  const [form, setForm] = useState({
    patientId: "", sessionDate: "", sessionType: "individual",
    durationMinutes: "60", chiefComplaint: "", sessionNotes: "",
    clinicianId: "", billingCode: "",
    suicideRisk: "none" as string, homocideRisk: "none" as string, elopementRisk: "none" as string,
  });

  const statuses = ["all", "scheduled", "in_progress", "completed", "cancelled", "no_show"];

  const filteredSessions = (sessionsData ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.chiefComplaint?.toLowerCase().includes(q) ?? false) ||
      (s.sessionNotes?.toLowerCase().includes(q) ?? false);
  });

  const { data: selectedSession } = trpc.bhc.getSession.useQuery(
    { id: selectedSessionId ?? "" },
    { enabled: !!selectedSessionId }
  );

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Clinical Sessions</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredSessions.length} sessions on record</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}>
          <Plus size={16} /> New Session
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search by complaint, notes..."
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

      {/* Sessions List */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading sessions...</p>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <FileText size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No clinical sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <div key={session.id}
              className="rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              onClick={() => setSelectedSessionId(session.id)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Calendar size={14} style={{ color: "#245C5A" }} />
                  <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {new Date(session.sessionDate).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: (STATUS_COLORS[session.status] ?? "#6B7280") + "15", color: STATUS_COLORS[session.status] }}>
                    {STATUS_LABELS[session.status] ?? session.status}
                  </span>
                  {session.sessionType && (
                    <span className="px-2 py-0.5 rounded-full text-[11px]"
                      style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                      {session.sessionType}
                    </span>
                  )}
                </div>
                <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--topbar-subtitle)" }}>
                  <Clock size={12} /> {session.durationMinutes} min
                </span>
              </div>
              {session.chiefComplaint && (
                <p className="text-[13px] font-medium mb-1" style={{ color: "var(--topbar-title)" }}>{session.chiefComplaint}</p>
              )}
              {session.sessionNotes && (
                <p className="text-[12px] line-clamp-2 mb-2" style={{ color: "var(--topbar-subtitle)" }}>{session.sessionNotes}</p>
              )}
              <div className="flex items-center gap-4">
                {session.riskAssessmentJson && (() => {
                  try {
                    const risk = JSON.parse(session.riskAssessmentJson);
                    return Object.entries(risk).map(([k, v]) => (
                      v !== "none" ? (
                        <span key={k} className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            backgroundColor: v === "high" ? "#FEE2E2" : v === "moderate" ? "#FFFBEB" : "#F0FDFA",
                            color: v === "high" ? "#DC2626" : v === "moderate" ? "#D97706" : "#059669",
                          }}>
                          <ShieldAlert size={10} className="inline mr-1" />
                          {k.replace(/([A-Z])/g, " $1").trim()}: {v as string}
                        </span>
                      ) : null
                    ));
                  } catch { return null; }
                })()}
                {session.billingCode && (
                  <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{session.billingCode}</span>
                )}
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
                <Stethoscope size={18} style={{ color: "#245C5A" }} /> New Session Note
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
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
                <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.sessionType} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}>
                  {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="Clinician ID *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.clinicianId} onChange={(e) => setForm({ ...form, clinicianId: e.target.value })} />
                <input placeholder="Billing Code" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.billingCode} onChange={(e) => setForm({ ...form, billingCode: e.target.value })} />
                <input type="number" placeholder="Duration (min)" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </div>
              <input placeholder="Chief Complaint" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} />
              <textarea placeholder="Session Notes" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-24 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.sessionNotes} onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })} />
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Risk Assessment</label>
                <div className="grid grid-cols-3 gap-2">
                  {["suicideRisk", "homocideRisk", "elopementRisk"].map((risk) => (
                    <div key={risk}>
                      <label className="text-[10px] block mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                        {risk.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                      <select className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                        value={form[risk as keyof typeof form]} onChange={(e) => setForm({ ...form, [risk]: e.target.value })}>
                        {["none", "low", "moderate", "high"].map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!form.patientId || !form.sessionDate || !form.clinicianId) return;
                createSession.mutate({
                  patientId: form.patientId, sessionDate: new Date(form.sessionDate).toISOString(),
                  sessionType: form.sessionType as any,
                  durationMinutes: parseInt(form.durationMinutes) || 60,
                  chiefComplaint: form.chiefComplaint || undefined,
                  sessionNotes: form.sessionNotes || undefined,
                  clinicianId: form.clinicianId,
                  billingCode: form.billingCode || undefined,
                  riskAssessment: { suicideRisk: form.suicideRisk as any, homocideRisk: form.homocideRisk as any, elopementRisk: form.elopementRisk as any },
                });
              }} disabled={createSession.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createSession.isPending ? "Saving..." : "Save Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSessionId && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedSessionId(null)}>
          <div className="rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>Session Details</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: (STATUS_COLORS[selectedSession.status] ?? "#6B7280") + "15", color: STATUS_COLORS[selectedSession.status] }}>
                  {STATUS_LABELS[selectedSession.status]}
                </span>
              </div>
              <X size={18} className="cursor-pointer" onClick={() => setSelectedSessionId(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Date</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{new Date(selectedSession.sessionDate).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Type</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedSession.sessionType ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Duration</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedSession.durationMinutes} min</p>
                </div>
              </div>

              {selectedSession.chiefComplaint && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Chief Complaint</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{selectedSession.chiefComplaint}</p>
                </div>
              )}

              {selectedSession.sessionNotes && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Session Notes</p>
                  <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--topbar-title)" }}>{selectedSession.sessionNotes}</p>
                </div>
              )}

              {selectedSession.riskAssessmentJson && (() => {
                try {
                  const risk = JSON.parse(selectedSession.riskAssessmentJson);
                  return (
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                      <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--topbar-subtitle)" }}>Risk Assessment</p>
                      <div className="flex gap-2">
                        {Object.entries(risk).map(([k, v]) => (
                          <span key={k} className="px-3 py-1 rounded-full text-[12px] font-semibold"
                            style={{
                              backgroundColor: v === "high" ? "#FEE2E2" : v === "moderate" ? "#FFFBEB" : "#F0FDFA",
                              color: v === "high" ? "#DC2626" : v === "moderate" ? "#D97706" : "#059669",
                            }}>
                            {k.replace(/([A-Z])/g, " $1").trim()}: {v as string}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {selectedSession.interventionsUsedJson && (() => {
                try {
                  const ivs = JSON.parse(selectedSession.interventionsUsedJson);
                  if (!ivs.length) return null;
                  return (
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                      <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Interventions Used</p>
                      <div className="flex flex-wrap gap-1">
                        {ivs.map((iv: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>{iv}</span>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                <span><strong>Clinician:</strong> {selectedSession.clinicianId?.slice(0, 12)}</span>
                {selectedSession.billingCode && <span><strong>Billing:</strong> {selectedSession.billingCode}</span>}
                {selectedSession.nextSessionDate && <span><strong>Next:</strong> {new Date(selectedSession.nextSessionDate).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClinicalSessionsPage;
