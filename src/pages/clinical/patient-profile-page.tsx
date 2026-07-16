import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  ArrowLeft, ArrowRight, Calendar, Phone, Mail, MapPin,
  User, ShieldAlert, FileText, Plus, X,
  CheckCircle, Clock
} from "lucide-react";

export const M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE =
  "metadata_only_quarantine" as const;
export const M41C_PATIENT_PROFILE_OUTCOME_TAB_TEST_ID =
  "m41c-patient-profile-outcome-governance" as const;

export function PatientProfileOutcomeGovernancePanel() {
  return (
    <section
      className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm"
      data-mode={M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE}
      data-testid={M41C_PATIENT_PROFILE_OUTCOME_TAB_TEST_ID}
    >
      <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-white to-teal-50 p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
          <ShieldAlert aria-hidden="true" className="size-4" />
          Governed evaluation boundary
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-950">
          Outcome Measure Governance
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          The inherited patient-profile execution display is unavailable.
          Authority, licensing, version, competency, and human-review controls
          are evaluated without protected instrument content, patient records,
          or computed clinical outputs.
        </p>
      </div>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-950">
            Synthetic evaluation only
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            No live clinical writes are available from this profile tab.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
          to="/clinical/intelligence-fabric"
        >
          Open Clinical Intelligence Fabric
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}

const STATUS_COLORS: Record<string, string> = {
  intake: "#2563EB", active: "#059669", hold: "#D97706",
  discharged: "#6B7280", transferred: "#7C3AED",
};
const PLAN_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", active: "#059669", under_review: "#D97706",
  completed: "#2563EB", discontinued: "#DC2626",
};

const DEMO_REFERENCE_DATE_MS = Date.UTC(2026, 6, 13);
export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const patientId = id ?? "";

  const { data, isLoading } = trpc.bhc.getPatient.useQuery({ id: patientId });
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"overview" | "plans" | "sessions" | "outcomes">("overview");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);

  // Mutations
  const dischargePatient = trpc.bhc.dischargePatient.useMutation({ onSuccess: () => utils.bhc.getPatient.invalidate({ id: patientId }) });
  const createPlan = trpc.bhc.createTreatmentPlan.useMutation({ onSuccess: () => { utils.bhc.getPatient.invalidate({ id: patientId }); setShowNewPlan(false); } });
  const createSession = trpc.bhc.createSession.useMutation({ onSuccess: () => { utils.bhc.getPatient.invalidate({ id: patientId }); setShowNewSession(false); } });

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 pt-4"><p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Loading patient...</p></div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 md:px-6 pt-4"><p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Patient not found</p></div>
    );
  }

  const { patient, treatmentPlans, recentSessions } = data;
  const age = Math.floor((DEMO_REFERENCE_DATE_MS - new Date(patient.dateOfBirth).getTime()) / 31557600000);

  // Risk assessment from latest session
  const latestSession = recentSessions[0];
  let riskLevel: string | null = null;
  if (latestSession?.riskAssessmentJson) {
    try {
      const risk = JSON.parse(latestSession.riskAssessmentJson);
      if (risk.suicideRisk === "high" || risk.homocideRisk === "high" || risk.elopementRisk === "high") riskLevel = "high";
      else if (risk.suicideRisk === "moderate" || risk.homocideRisk === "moderate" || risk.elopementRisk === "moderate") riskLevel = "moderate";
    } catch { /* ignore */ }
  }

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "plans" as const, label: `Treatment Plans (${treatmentPlans.length})` },
    { key: "sessions" as const, label: `Sessions (${recentSessions.length})` },
    { key: "outcomes" as const, label: "Outcome Governance" },
  ];

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        {/* Back + Header */}
        <button onClick={() => navigate("/clinical/patients")} className="flex items-center gap-1 text-[12px] mb-4 hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Back to Patient Registry
        </button>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: STATUS_COLORS[patient.status] ?? "#6B7280" }}
            >
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
                  {patient.lastName}, {patient.firstName}
                </h1>
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: (STATUS_COLORS[patient.status] ?? "#6B7280") + "15", color: STATUS_COLORS[patient.status] }}
                >
                  {patient.status}
                </span>
                {riskLevel && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                    <ShieldAlert size={12} /> {riskLevel.toUpperCase()} RISK
                  </span>
                )}
              </div>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                {patient.mrn} &bull; {age} years old &bull; {patient.gender ?? "Not specified"}
              </p>
            </div>
          </div>
          {patient.status !== "discharged" && (
            <button
              onClick={() => {
                const reason = window.prompt("Discharge reason?");
                if (reason) dischargePatient.mutate({ id: patientId, reason });
              }}
              className="px-3 py-2 rounded-lg text-[12px] font-medium border"
              style={{ borderColor: "#DC2626", color: "#DC2626" }}
            >
              Discharge
            </button>
          )}
        </div>

        {/* Demographics Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Phone size={14} style={{ color: "var(--topbar-subtitle)" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Phone</span>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Mail size={14} style={{ color: "var(--topbar-subtitle)" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Email</span>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{patient.email ?? "—"}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} style={{ color: "var(--topbar-subtitle)" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Address</span>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{patient.address ?? "—"}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <User size={14} style={{ color: "var(--topbar-subtitle)" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Emergency</span>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
              {patient.emergencyName ?? "—"} {patient.emergencyPhone && `(${patient.emergencyPhone})`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-[13px] font-medium transition-all"
              style={{
                color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
                borderBottom: `2px solid ${activeTab === tab.key ? "#245C5A" : "transparent"}`,
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Treatment Plan */}
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Active Treatment Plan</h3>
              {treatmentPlans.filter((p) => p.status === "active").length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No active treatment plan</p>
              ) : (
                treatmentPlans.filter((p) => p.status === "active").map((plan) => (
                  <div key={plan.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{plan.planNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "#05966915", color: "#059669" }}>Active</span>
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{plan.primaryDiagnosis}</p>
                    <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{plan.presentingProblem}</p>
                    {plan.goalsJson && (
                      <div className="mt-2">
                        <p className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Goals</p>
                        <div className="space-y-1">
                          {JSON.parse(plan.goalsJson).map((g: { description: string }, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[12px]">
                              <CheckCircle size={12} style={{ color: "#059669" }} />
                              <span style={{ color: "var(--topbar-title)" }}>{g.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Recent Sessions */}
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Recent Sessions</h3>
              {recentSessions.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No sessions recorded</p>
              ) : (
                <div className="space-y-2">
                  {recentSessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="flex items-center gap-3 p-2 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F0FDFA" }}>
                        <FileText size={14} style={{ color: "#245C5A" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>
                          {new Date(session.sessionDate).toLocaleDateString()} &bull; {session.sessionType ?? "Session"}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--topbar-subtitle)" }}>
                          {session.chiefComplaint ?? "No chief complaint recorded"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "plans" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Treatment Plans</h3>
              <button onClick={() => setShowNewPlan(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
                <Plus size={14} /> New Plan
              </button>
            </div>
            <div className="space-y-3">
              {treatmentPlans.map((plan) => (
                <div key={plan.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{plan.planNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (PLAN_STATUS_COLORS[plan.status] ?? "#6B7280") + "15", color: PLAN_STATUS_COLORS[plan.status] }}>
                        {plan.status}
                      </span>
                    </div>
                    {plan.status === "under_review" && (
                      <button
                        onClick={() => { const clinicianId = window.prompt("Your clinician ID?"); if (clinicianId) { /* approve mutation */ } }}
                        className="px-3 py-1 rounded-lg text-[11px] font-medium text-white"
                        style={{ backgroundColor: "#059669" }}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{plan.primaryDiagnosis}</p>
                  {plan.secondaryDiagnosis && <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Secondary: {plan.secondaryDiagnosis}</p>}
                  <p className="text-[13px] mt-1" style={{ color: "var(--topbar-title)" }}>{plan.presentingProblem}</p>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {plan.goalsJson && (
                      <div>
                        <p className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Goals</p>
                        {JSON.parse(plan.goalsJson).map((g: { description: string; targetDate?: string }, i: number) => (
                          <div key={i} className="flex items-start gap-1 text-[12px]">
                            <CheckCircle size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                            <span style={{ color: "var(--topbar-title)" }}>{g.description} {g.targetDate && <span style={{ color: "var(--topbar-subtitle)" }}>({new Date(g.targetDate).toLocaleDateString()})</span>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {plan.interventionsJson && (
                      <div>
                        <p className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Interventions</p>
                        {JSON.parse(plan.interventionsJson).map((intervention: { type: string; description: string; frequency: string }, i: number) => (
                          <div key={i} className="text-[12px]" style={{ color: "var(--topbar-title)" }}>
                            <span className="font-medium">{intervention.type}:</span> {intervention.description} ({intervention.frequency})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Clinical Sessions</h3>
              <button onClick={() => setShowNewSession(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
                <Plus size={14} /> New Session
              </button>
            </div>
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div key={session.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} style={{ color: "#245C5A" }} />
                      <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                        {new Date(session.sessionDate).toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                        {session.sessionType ?? "session"}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{session.durationMinutes} min</span>
                  </div>
                  {session.chiefComplaint && <p className="text-[12px] mb-1" style={{ color: "var(--topbar-title)" }}><strong>Chief Complaint:</strong> {session.chiefComplaint}</p>}
                  {session.sessionNotes && <p className="text-[12px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>{session.sessionNotes}</p>}
                  {session.riskAssessmentJson && (
                    <div className="flex gap-2 mt-2">
                      {(() => { try { const r = JSON.parse(session.riskAssessmentJson); return Object.entries(r).map(([k, v]) => v !== "none" ? (
                        <span key={k} className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: v === "high" ? "#FEE2E2" : v === "moderate" ? "#FFFBEB" : "#F0FDFA", color: v === "high" ? "#DC2626" : v === "moderate" ? "#D97706" : "#059669" }}>
                          {k.replace(/([A-Z])/g, " $1").trim()}: {v as string}
                        </span>
                      ) : null); } catch { return null; } })()}
                    </div>
                  )}
                  {session.nextSessionDate && (
                    <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--topbar-subtitle)" }}>
                      <Clock size={12} /> Next: {new Date(session.nextSessionDate).toLocaleDateString()} — {session.nextSessionGoals}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "outcomes" && (
          <PatientProfileOutcomeGovernancePanel />
        )}
      </div>

      {/* New Plan Modal */}
      {showNewPlan && (
        <NewPlanModal patientId={patientId} onClose={() => setShowNewPlan(false)} onSubmit={(data) => createPlan.mutate(data)} isPending={createPlan.isPending} />
      )}
      {showNewSession && (
        <NewSessionModal patientId={patientId} onClose={() => setShowNewSession(false)} onSubmit={(data) => createSession.mutate(data)} isPending={createSession.isPending} />
      )}
  </>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function NewPlanModal({ patientId, onClose, onSubmit, isPending }: {
  patientId: string; onClose: () => void;
  onSubmit: (data: { patientId: string; primaryDiagnosis: string; secondaryDiagnosis?: string; presentingProblem: string; goals: { description: string; targetDate?: string }[]; interventions: { type: string; description: string; frequency: string }[]; estimatedDurationWeeks?: number; startDate: string; reviewDate: string; assignedClinicianId: string; supervisorId?: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    primaryDiagnosis: "", secondaryDiagnosis: "", presentingProblem: "",
    goals: [{ description: "", targetDate: "" }], interventions: [{ type: "", description: "", frequency: "" }],
    estimatedDurationWeeks: "", startDate: "", reviewDate: "", assignedClinicianId: "", supervisorId: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>New Treatment Plan</h2>
          <X size={18} className="cursor-pointer" onClick={onClose} style={{ color: "var(--topbar-subtitle)" }} />
        </div>
        <div className="space-y-3">
          <input placeholder="Primary Diagnosis *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.primaryDiagnosis} onChange={(e) => setForm({ ...form, primaryDiagnosis: e.target.value })} />
          <input placeholder="Secondary Diagnosis" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.secondaryDiagnosis} onChange={(e) => setForm({ ...form, secondaryDiagnosis: e.target.value })} />
          <textarea placeholder="Presenting Problem *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-20 resize-none" style={{ borderColor: "var(--card-border)" }} value={form.presentingProblem} onChange={(e) => setForm({ ...form, presentingProblem: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" placeholder="Start Date *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="date" placeholder="Review Date *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Assigned Clinician ID *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.assignedClinicianId} onChange={(e) => setForm({ ...form, assignedClinicianId: e.target.value })} />
            <input type="number" placeholder="Duration (weeks)" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.estimatedDurationWeeks} onChange={(e) => setForm({ ...form, estimatedDurationWeeks: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Goals</label>
            {form.goals.map((g, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <input placeholder="Goal description" className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={g.description} onChange={(e) => { const goals = [...form.goals]; goals[i].description = e.target.value; setForm({ ...form, goals }); }} />
                <input type="date" className="w-32 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={g.targetDate} onChange={(e) => { const goals = [...form.goals]; goals[i].targetDate = e.target.value; setForm({ ...form, goals }); }} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Interventions</label>
            {form.interventions.map((inv, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <input placeholder="Type" className="w-24 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={inv.type} onChange={(e) => { const interventions = [...form.interventions]; interventions[i].type = e.target.value; setForm({ ...form, interventions }); }} />
                <input placeholder="Description" className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={inv.description} onChange={(e) => { const interventions = [...form.interventions]; interventions[i].description = e.target.value; setForm({ ...form, interventions }); }} />
                <input placeholder="Frequency" className="w-28 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={inv.frequency} onChange={(e) => { const interventions = [...form.interventions]; interventions[i].frequency = e.target.value; setForm({ ...form, interventions }); }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
          <button
            onClick={() => onSubmit({ patientId, primaryDiagnosis: form.primaryDiagnosis, secondaryDiagnosis: form.secondaryDiagnosis || undefined, presentingProblem: form.presentingProblem, goals: form.goals.filter((g) => g.description), interventions: form.interventions.filter((i) => i.description), estimatedDurationWeeks: form.estimatedDurationWeeks ? parseInt(form.estimatedDurationWeeks) : undefined, startDate: form.startDate, reviewDate: form.reviewDate, assignedClinicianId: form.assignedClinicianId })}
            disabled={isPending || !form.primaryDiagnosis || !form.presentingProblem || !form.startDate || !form.reviewDate || !form.assignedClinicianId}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#245C5A" }}
          >
            {isPending ? "Creating..." : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSessionModal({ patientId, onClose, onSubmit, isPending }: {
  patientId: string; onClose: () => void;
  onSubmit: (data: { patientId: string; sessionDate: string; sessionType?: "individual" | "group" | "family" | "couples" | "intake" | "crisis" | "telehealth"; durationMinutes: number; chiefComplaint?: string; sessionNotes?: string; clinicianId: string; billingCode?: string; riskAssessment?: { suicideRisk?: "none" | "low" | "moderate" | "high"; homocideRisk?: "none" | "low" | "moderate" | "high"; elopementRisk?: "none" | "low" | "moderate" | "high" } }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    sessionDate: "", sessionType: "individual" as string, durationMinutes: "60",
    chiefComplaint: "", sessionNotes: "", clinicianId: "", billingCode: "",
    suicideRisk: "none" as string, homocideRisk: "none" as string, elopementRisk: "none" as string,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>New Session Note</h2>
          <X size={18} className="cursor-pointer" onClick={onClose} style={{ color: "var(--topbar-subtitle)" }} />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="datetime-local" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
            <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.sessionType} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}>
              {["individual", "group", "family", "couples", "intake", "crisis", "telehealth"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Clinician ID *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.clinicianId} onChange={(e) => setForm({ ...form, clinicianId: e.target.value })} />
            <input placeholder="Billing Code" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.billingCode} onChange={(e) => setForm({ ...form, billingCode: e.target.value })} />
          </div>
          <input placeholder="Chief Complaint" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} />
          <textarea placeholder="Session Notes" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-24 resize-none" style={{ borderColor: "var(--card-border)" }} value={form.sessionNotes} onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })} />
          <div>
            <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Risk Assessment</label>
            <div className="grid grid-cols-3 gap-2">
              {["suicideRisk", "homocideRisk", "elopementRisk"].map((risk) => (
                <div key={risk}>
                  <label className="text-[10px] block mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>{risk.replace(/([A-Z])/g, " $1").trim()}</label>
                  <select className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }} value={form[risk as keyof typeof form]} onChange={(e) => setForm({ ...form, [risk]: e.target.value })}>
                    {["none", "low", "moderate", "high"].map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
          <button
            onClick={() => onSubmit({
              patientId,
              sessionDate: new Date(form.sessionDate).toISOString(),
              sessionType: form.sessionType as Parameters<typeof onSubmit>[0]["sessionType"],
              durationMinutes: parseInt(form.durationMinutes) || 60,
              chiefComplaint: form.chiefComplaint || undefined,
              sessionNotes: form.sessionNotes || undefined,
              clinicianId: form.clinicianId,
              billingCode: form.billingCode || undefined,
              riskAssessment: {
                suicideRisk: form.suicideRisk as NonNullable<Parameters<typeof onSubmit>[0]["riskAssessment"]>["suicideRisk"],
                homocideRisk: form.homocideRisk as NonNullable<Parameters<typeof onSubmit>[0]["riskAssessment"]>["homocideRisk"],
                elopementRisk: form.elopementRisk as NonNullable<Parameters<typeof onSubmit>[0]["riskAssessment"]>["elopementRisk"],
              },
            })}
            disabled={isPending || !form.sessionDate || !form.clinicianId}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#245C5A" }}
          >
            {isPending ? "Saving..." : "Save Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PatientProfilePage;
