import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Activity, Search, Plus, Filter, X, TrendingUp, TrendingDown, Minus,
  BarChart3, Users
} from "lucide-react";

const MEASURE_TYPES = ["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"] as const;
const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: "None", color: "#059669" }, minimal: { label: "Minimal", color: "#10B981" },
  mild: { label: "Mild", color: "#D97706" }, moderate: { label: "Moderate", color: "#F59E0B" },
  moderately_severe: { label: "Mod. Severe", color: "#EA580C" }, severe: { label: "Severe", color: "#DC2626" },
};

export function OutcomeMeasuresPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const { data: measuresData, isLoading } = trpc.bhc.listOutcomeMeasures.useQuery(
    typeFilter === "all" ? undefined : { measureType: typeFilter }
  );
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const { data: trendsData } = trpc.bhc.getOutcomeTrends.useQuery(
    { patientId: selectedPatientId ?? "" },
    { enabled: !!selectedPatientId }
  );
  const utils = trpc.useUtils();

  const createMeasure = trpc.bhc.createOutcomeMeasure.useMutation({
    onSuccess: () => { utils.bhc.listOutcomeMeasures.invalidate(); setShowCreate(false); },
  });

  const [form, setForm] = useState({
    patientId: "", measureType: "PHQ-9" as typeof MEASURE_TYPES[number],
    score: "", maxScore: "27", severityLevel: "" as string, administeredBy: "", notes: "",
  });

  const filteredMeasures = (measuresData ?? []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.notes?.toLowerCase().includes(q) ?? false) || m.measureType.toLowerCase().includes(q);
  });

  // Calculate aggregate stats
  const stats = (measuresData ?? []).reduce((acc, m) => {
    if (!acc[m.measureType]) acc[m.measureType] = { count: 0, avgScore: 0, totalScore: 0, maxScore: m.maxScore };
    acc[m.measureType].count++;
    acc[m.measureType].totalScore += m.score;
    acc[m.measureType].avgScore = acc[m.measureType].totalScore / acc[m.measureType].count;
    return acc;
  }, {} as Record<string, { count: number; avgScore: number; totalScore: number; maxScore: number }>);

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Outcome Measures</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredMeasures.length} assessments recorded</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}>
          <Plus size={16} /> Record Score
        </button>
      </div>

      {/* Aggregate Stats */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(stats).slice(0, 4).map(([type, s]) => (
            <div key={type} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--topbar-subtitle)" }}>{type}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] font-bold" style={{ color: "var(--topbar-title)" }}>{s.avgScore.toFixed(1)}</span>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>/ {s.maxScore} avg</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{s.count} assessments</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search..."
            className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <X size={14} className="cursor-pointer" onClick={() => setSearch("")} style={{ color: "var(--topbar-subtitle)" }} />}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={14} style={{ color: "var(--topbar-subtitle)" }} />
          <button onClick={() => setTypeFilter("all")}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
            style={{ backgroundColor: typeFilter === "all" ? "#245C5A" : "var(--card-bg)", color: typeFilter === "all" ? "#fff" : "var(--topbar-subtitle)", border: `1px solid ${typeFilter === "all" ? "#245C5A" : "var(--card-border)"}` }}>All</button>
          {MEASURE_TYPES.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
              style={{ backgroundColor: typeFilter === t ? "#245C5A" : "var(--card-bg)", color: typeFilter === t ? "#fff" : "var(--topbar-subtitle)", border: `1px solid ${typeFilter === t ? "#245C5A" : "var(--card-border)"}` }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Trends Section */}
      <div className="mb-4">
        <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>View Trends for Patient</label>
        <select
          className="w-full max-w-sm rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
          value={selectedPatientId ?? ""}
          onChange={(e) => setSelectedPatientId(e.target.value || null)}>
          <option value="">Select patient to view trends...</option>
          {(patientsData?.patients ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} — {p.mrn}</option>
          ))}
        </select>
      </div>

      {/* Trends Visualization */}
      {selectedPatientId && trendsData && Object.keys(trendsData).length > 0 && (
        <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <TrendingUp size={16} style={{ color: "#245C5A" }} /> Patient Trend Data
          </h3>
          {Object.entries(trendsData).map(([measureType, data]) => (
            <div key={measureType} className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: "var(--topbar-title)" }}>{measureType}</p>
              <div className="flex items-end gap-1 h-20">
                {data.map((d, i) => {
                  const pct = Math.min(100, (d.score / d.maxScore) * 100);
                  const color = pct > 75 ? "#DC2626" : pct > 50 ? "#D97706" : "#059669";
                  return (
                    <div key={d.id} className="flex-1 flex flex-col items-center group relative">
                      <span className="text-[9px] mb-0.5" style={{ color }}>{d.score}</span>
                      <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(8, pct)}%`, backgroundColor: color, opacity: 0.7 + (i / data.length) * 0.3 }} />
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap z-10 transition-opacity"
                        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--topbar-title)" }}>
                        {new Date(d.administeredAt).toLocaleDateString()}: {d.score}/{d.maxScore}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {data.length} data points
                </span>
                {data.length >= 2 && (() => {
                  const first = data[0].score;
                  const last = data[data.length - 1].score;
                  const diff = last - first;
                  const Icon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
                  return (
                    <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: diff < 0 ? "#059669" : diff > 0 ? "#DC2626" : "var(--topbar-subtitle)" }}>
                      <Icon size={12} /> {diff > 0 ? "+" : ""}{diff} from first
                    </span>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Measures List */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading measures...</p>
      ) : filteredMeasures.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Activity size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No outcome measures found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeasures.map((m) => {
            const pct = Math.round((m.score / m.maxScore) * 100);
            const sev = m.severityLevel ? SEVERITY_LABELS[m.severityLevel] : null;
            return (
              <div key={m.id}
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                      style={{ backgroundColor: "#245C5A15", color: "#245C5A" }}>
                      {m.measureType}
                    </span>
                    <span className="text-[18px] font-bold" style={{ color: "var(--topbar-title)" }}>
                      {m.score}<span className="text-[13px] font-normal" style={{ color: "var(--topbar-subtitle)" }}>/{m.maxScore}</span>
                    </span>
                    {sev && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: sev.color + "15", color: sev.color }}>
                        {sev.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {new Date(m.administeredAt).toLocaleDateString()}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: "var(--card-border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: sev?.color ?? "#245C5A" }} />
                </div>
                <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span className="flex items-center gap-1"><Users size={11} /> By: {m.administeredBy?.slice(0, 12) ?? "—"}</span>
                  {m.notes && <span className="truncate max-w-[300px]">{m.notes}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl border p-6 w-full max-w-md"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Activity size={18} style={{ color: "#245C5A" }} /> Record Outcome Measure
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
              <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.measureType} onChange={(e) => setForm({ ...form, measureType: e.target.value as typeof MEASURE_TYPES[number] })}>
                {MEASURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Score *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                <input type="number" placeholder="Max Score" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                  value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
              </div>
              <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.severityLevel} onChange={(e) => setForm({ ...form, severityLevel: e.target.value })}>
                <option value="">Severity Level (auto)</option>
                {Object.entries(SEVERITY_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input placeholder="Administered By (User ID) *" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }}
                value={form.administeredBy} onChange={(e) => setForm({ ...form, administeredBy: e.target.value })} />
              <textarea placeholder="Notes" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none h-20 resize-none" style={{ borderColor: "var(--card-border)" }}
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              <button onClick={() => {
                if (!form.patientId || !form.score || !form.administeredBy) return;
                createMeasure.mutate({
                  patientId: form.patientId, measureType: form.measureType,
                  score: parseInt(form.score), maxScore: parseInt(form.maxScore) || 27,
                  severityLevel: (form.severityLevel || undefined) as any,
                  administeredBy: form.administeredBy, notes: form.notes || undefined,
                });
              }} disabled={createMeasure.isPending}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                {createMeasure.isPending ? "Saving..." : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OutcomeMeasuresPage;
