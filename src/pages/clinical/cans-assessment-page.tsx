import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  ClipboardList, Search, Plus, Filter, X, ShieldAlert, ShieldCheck,
  AlertTriangle, CheckCircle, User, Calendar, ChevronDown, ChevronUp,
  TrendingUp
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", in_progress: "#D97706", pending_review: "#2563EB",
  completed: "#059669", superseded: "#6B7280",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress", pending_review: "Pending Review",
  completed: "Completed", superseded: "Superseded",
};
const RISK_COLORS: Record<string, string> = {
  none: "#059669", low: "#10B981", moderate: "#D97706", high: "#EA580C", imminent: "#DC2626",
};
const LOC_LEVELS = [
  { value: "loc_1_high_acuity", label: "LOC 1 — High Acuity" },
  { value: "loc_2_moderate_acuity", label: "LOC 2 — Moderate Acuity" },
  { value: "loc_3_low_acuity", label: "LOC 3 — Low Acuity" },
  { value: "not_determined", label: "Not Determined" },
] as const;
const CANS_DOMAINS = [
  "Life Functioning", "Behavioral & Emotional Needs", "Risk Behaviors",
  "Cultural Factors", "Youth Strengths", "Caregiver Strengths & Needs",
  "Acculturation", "Substance Use", "Child Strengths", "Caregiver Resources",
];

export function CansAssessmentPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<number | null>(null);

  const { data: assessments, isLoading } = trpc.bhc.listCansAssessments.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const { data: selectedAssessment } = trpc.bhc.getCansAssessment.useQuery(
    { id: selectedAssessmentId ?? "" }, { enabled: !!selectedAssessmentId }
  );
  const { data: assessmentDomainsList } = trpc.bhc.listAssessmentDomains.useQuery(
    { assessmentId: selectedAssessmentId ?? "" }, { enabled: !!selectedAssessmentId }
  );
  const utils = trpc.useUtils();

  const createAssessment = trpc.bhc.createCansAssessment.useMutation({
    onSuccess: () => { utils.bhc.listCansAssessments.invalidate(); setShowCreate(false); },
  });
  const updateAssessment = trpc.bhc.updateCansAssessment.useMutation({
    onSuccess: () => { utils.bhc.listCansAssessments.invalidate(); utils.bhc.getCansAssessment.invalidate(); },
  });
  const completeAssessment = trpc.bhc.completeCansAssessment.useMutation({
    onSuccess: () => { utils.bhc.listCansAssessments.invalidate(); utils.bhc.getCansAssessment.invalidate(); },
  });
  const createDomain = trpc.bhc.createAssessmentDomain.useMutation({
    onSuccess: () => {
      utils.bhc.listAssessmentDomains.invalidate();
      utils.bhc.getCansAssessment.invalidate();
    },
  });
  const updateDomain = trpc.bhc.updateAssessmentDomain.useMutation({
    onSuccess: () => utils.bhc.listAssessmentDomains.invalidate(),
  });

  const [form, setForm] = useState({
    youthId: "", youthName: "", mrn: "", assessmentType: "intake" as "intake" | "quarterly" | "annual" | "discharge" | "incident_driven",
    assessmentDate: new Date().toISOString().split("T")[0], completedBy: "", presentingProblems: "",
    psychiatricHistory: "", substanceUseHistory: "", traumaHistory: "",
    medicalHistory: "", familyHistory: "", educationalHistory: "",
    riskSuicide: "none" as string, riskSelfHarm: "none" as string, riskAggression: "none" as string,
    riskElopement: "none" as string, riskSubstanceUse: "none" as string, riskVulnerability: "none" as string,
    safetyPlanRequired: false,
  });

  const [domainForm, setDomainForm] = useState({
    domainNumber: 1, domainName: "", score: "", scoreLabel: "" as string,
    strengths: "", needs: "", observations: "", clinicalNotes: "", interventionNeeded: false, interventionDescription: "",
  });

  const statuses = ["all", "draft", "in_progress", "pending_review", "completed"];

  const filteredAssessments = (assessments ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.youthName.toLowerCase().includes(q) || a.mrn.toLowerCase().includes(q);
  });

  const overallRisk = (a: NonNullable<typeof selectedAssessment>) => {
    const risks = [a.riskSuicide, a.riskSelfHarm, a.riskAggression, a.riskElopement, a.riskSubstanceUse, a.riskVulnerability];
    if (risks.some((r) => r === "imminent")) return { level: "critical", color: "#DC2626" };
    if (risks.some((r) => r === "high")) return { level: "high", color: "#EA580C" };
    if (risks.some((r) => r === "moderate")) return { level: "moderate", color: "#D97706" };
    return { level: "low", color: "#059669" };
  };

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>CANS / TRR Assessments</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            {filteredAssessments.length} assessments — {assessments?.filter((a) => a.status === "draft" || a.status === "in_progress").length ?? 0} active
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}>
          <Plus size={16} /> New Assessment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search by youth name, MRN..."
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

      {/* Assessments List */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading assessments...</p>
      ) : filteredAssessments.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <ClipboardList size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No CANS assessments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map((a) => (
            <div key={a.id}
              className="rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              onClick={() => setSelectedAssessmentId(a.id)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{a.youthName}</span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{a.mrn}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: (STATUS_COLORS[a.status] ?? "#6B7280") + "15", color: STATUS_COLORS[a.status] }}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                    style={{ backgroundColor: "#245C5A10", color: "#245C5A" }}>
                    {a.assessmentType}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {new Date(a.assessmentDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {a.cansTotalScore !== null && (
                  <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    CANS Score: <strong>{a.cansTotalScore}</strong>
                    {a.cansRiskLevel && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: (a.cansRiskLevel === "very_high" ? "#DC2626" : a.cansRiskLevel === "high" ? "#EA580C" : a.cansRiskLevel === "moderate" ? "#D97706" : "#059669") + "15",
                          color: a.cansRiskLevel === "very_high" ? "#DC2626" : a.cansRiskLevel === "high" ? "#EA580C" : a.cansRiskLevel === "moderate" ? "#D97706" : "#059669" }}>
                        {a.cansRiskLevel.replace(/_/g, " ")}
                      </span>
                    )}
                  </span>
                )}
                {a.locLevel && a.locLevel !== "not_determined" && (
                  <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                    LOC: {a.locLevel.replace(/_/g, " ")}
                  </span>
                )}
                {a.safetyPlanRequired && (
                  <span className="flex items-center gap-1 text-[11px] text-red-600">
                    <ShieldAlert size={12} /> Safety Plan Required
                  </span>
                )}
              </div>
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
                <ClipboardList size={18} style={{ color: "#245C5A" }} /> New CANS Assessment
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                onChange={(e) => {
                  const p = patientsData?.patients.find((pp) => pp.id === e.target.value);
                  if (p) setForm({ ...form, youthId: p.id, youthName: `${p.firstName} ${p.lastName}`, mrn: p.mrn });
                }}>
                <option value="">Select Youth...</option>
                {(patientsData?.patients ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} — {p.mrn}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.assessmentType} onChange={(e) => setForm({ ...form, assessmentType: e.target.value as any })}>
                  <option value="intake">Intake</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="discharge">Discharge</option>
                  <option value="incident_driven">Incident-Driven</option>
                </select>
                <input type="date" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.assessmentDate} onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })} />
              </div>
              <input placeholder="Completed By *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.completedBy} onChange={(e) => setForm({ ...form, completedBy: e.target.value })} />
              <textarea placeholder="Presenting Problems" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-16 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.presentingProblems} onChange={(e) => setForm({ ...form, presentingProblems: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                {["riskSuicide", "riskSelfHarm", "riskAggression", "riskElopement", "riskSubstanceUse", "riskVulnerability"].map((risk) => (
                  <div key={risk}>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                      {risk.replace(/risk/, "").replace(/([A-Z])/g, " $1").trim()}
                    </label>
                    <select className="w-full rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                      value={form[risk as keyof typeof form] as string} onChange={(e) => setForm({ ...form, [risk]: e.target.value })}>
                      {["none", "low", "moderate", "high", "imminent"].map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--topbar-title)" }}>
                <input type="checkbox" checked={form.safetyPlanRequired}
                  onChange={(e) => setForm({ ...form, safetyPlanRequired: e.target.checked })} />
                Safety Plan Required
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!form.youthId || !form.completedBy) return;
                createAssessment.mutate({ ...form });
              }} disabled={createAssessment.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createAssessment.isPending ? "Creating..." : "Create Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedAssessmentId && selectedAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedAssessmentId(null); setExpandedDomain(null); }}>
          <div className="rounded-xl border p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>CANS Assessment</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: (STATUS_COLORS[selectedAssessment.status] ?? "#6B7280") + "15", color: STATUS_COLORS[selectedAssessment.status] }}>
                  {STATUS_LABELS[selectedAssessment.status]}
                </span>
              </div>
              <X size={18} className="cursor-pointer" onClick={() => { setSelectedAssessmentId(null); setExpandedDomain(null); }} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            {/* Youth Info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth</p>
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedAssessment.youthName}</p>
                <p className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{selectedAssessment.mrn}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>Assessment</p>
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedAssessment.assessmentType} — {new Date(selectedAssessment.assessmentDate).toLocaleDateString()}</p>
                <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>By: {selectedAssessment.completedBy}</p>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="rounded-lg border p-3 mb-4" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Risk Assessment</p>
                {(() => { const or = overallRisk(selectedAssessment); return (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: or.color + "15", color: or.color }}>
                    {or.level.toUpperCase()} RISK
                  </span>
                ); })()}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "riskSuicide", label: "Suicide" }, { key: "riskSelfHarm", label: "Self-Harm" },
                  { key: "riskAggression", label: "Aggression" }, { key: "riskElopement", label: "Elopement" },
                  { key: "riskSubstanceUse", label: "Substance Use" }, { key: "riskVulnerability", label: "Vulnerability" },
                ].map(({ key, label }) => {
                  const val = selectedAssessment[key as keyof typeof selectedAssessment] as string | null;
                  return (
                    <div key={key} className="flex items-center gap-2 text-[12px]">
                      <span style={{ color: RISK_COLORS[val ?? "none"] ?? "#059669" }}>●</span>
                      <span style={{ color: "var(--topbar-title)" }}>{label}:</span>
                      <span className="font-medium capitalize" style={{ color: RISK_COLORS[val ?? "none"] }}>{val ?? "none"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CANS Score */}
            {selectedAssessment.cansTotalScore !== null && (
              <div className="rounded-lg border p-3 mb-4" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>CANS Total Score</p>
                    <p className="text-[24px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedAssessment.cansTotalScore}</p>
                  </div>
                  {selectedAssessment.cansRiskLevel && (
                    <span className="px-3 py-1 rounded-full text-[13px] font-bold"
                      style={{
                        backgroundColor: (selectedAssessment.cansRiskLevel === "very_high" ? "#DC2626" : selectedAssessment.cansRiskLevel === "high" ? "#EA580C" : "#059669") + "15",
                        color: selectedAssessment.cansRiskLevel === "very_high" ? "#DC2626" : selectedAssessment.cansRiskLevel === "high" ? "#EA580C" : "#059669",
                      }}>
                      {selectedAssessment.cansRiskLevel.replace(/_/g, " ").toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Domain Scoring Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>Domain Scores ({assessmentDomainsList?.length ?? 0}/{CANS_DOMAINS.length})</p>
              </div>

              {/* Add Domain */}
              <div className="rounded-lg border p-3 mb-3" style={{ borderColor: "var(--card-border)" }}>
                <div className="grid grid-cols-6 gap-2">
                  <select className="col-span-2 rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                    value={domainForm.domainName} onChange={(e) => {
                      const idx = CANS_DOMAINS.indexOf(e.target.value);
                      setDomainForm({ ...domainForm, domainName: e.target.value, domainNumber: idx + 1 });
                    }}>
                    <option value="">Select Domain...</option>
                    {CANS_DOMAINS.map((d, i) => (
                      <option key={i} value={d}>{i + 1}. {d}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Score" className="rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                    value={domainForm.score} onChange={(e) => setDomainForm({ ...domainForm, score: e.target.value })} />
                  <select className="rounded border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
                    value={domainForm.scoreLabel} onChange={(e) => setDomainForm({ ...domainForm, scoreLabel: e.target.value })}>
                    <option value="">Label</option>
                    <option value="no_evidence">No Evidence</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                  <button onClick={() => {
                    if (!domainForm.domainName || !domainForm.score) return;
                    createDomain.mutate({
                      assessmentId: selectedAssessmentId,
                      domainNumber: domainForm.domainNumber,
                      domainName: domainForm.domainName,
                      score: parseInt(domainForm.score),
                      scoreLabel: (domainForm.scoreLabel || undefined) as any,
                    }, { onSuccess: () => setDomainForm({ ...domainForm, score: "", scoreLabel: "" }) });
                  }} disabled={createDomain.isPending}
                    className="col-span-2 px-3 py-1 rounded text-[11px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                    {createDomain.isPending ? "..." : "Add Domain"}
                  </button>
                </div>
              </div>

              {/* Domain List */}
              {(assessmentDomainsList ?? []).map((d) => (
                <div key={d.id} className="rounded-lg border p-3 mb-2" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold" style={{ color: "#245C5A" }}>{d.domainNumber}</span>
                      <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{d.domainName}</span>
                      {d.score !== null && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: "#245C5A15", color: "#245C5A" }}>{d.score}</span>
                      )}
                      {d.scoreLabel && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: (d.scoreLabel === "severe" ? "#FEE2E2" : d.scoreLabel === "moderate" ? "#FFFBEB" : "#F0FDFA"),
                            color: d.scoreLabel === "severe" ? "#DC2626" : d.scoreLabel === "moderate" ? "#D97706" : "#059669" }}>
                          {d.scoreLabel.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {(d.strengths || d.needs || d.observations) && (
                    <div className="mt-2 text-[11px] space-y-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                      {d.strengths && <p><strong>Strengths:</strong> {d.strengths}</p>}
                      {d.needs && <p><strong>Needs:</strong> {d.needs}</p>}
                      {d.observations && <p><strong>Obs:</strong> {d.observations}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {(selectedAssessment.status === "draft" || selectedAssessment.status === "in_progress") && (
                <button onClick={() => {
                  updateAssessment.mutate({
                    id: selectedAssessmentId,
                    status: selectedAssessment.status === "draft" ? "in_progress" : "pending_review",
                  });
                }}
                  className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#245C5A" }}>
                  <ChevronUp size={14} /> {selectedAssessment.status === "draft" ? "Start Assessment" : "Submit for Review"}
                </button>
              )}
              {selectedAssessment.status === "pending_review" && (
                <button onClick={() => completeAssessment.mutate({ id: selectedAssessmentId, approvedBy: "current-user" })}
                  className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2">
                  <CheckCircle size={14} /> Complete Assessment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CansAssessmentPage;
