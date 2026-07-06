import { useState } from "react";
import {
  ClipboardCheck, ChevronDown, ChevronUp, Save, RotateCcw,
  TrendingUp, AlertTriangle, CheckCircle2, User, Calendar,
} from "lucide-react";

interface CANSItem {
  id: string;
  domain: string;
  item: string;
  score: number | null;
  notes: string;
}

const CANS_DOMAINS = [
  {
    name: "Life Functioning",
    description: "Day-to-day skills and functioning",
    items: [
      { id: "lf1", item: "Family functioning", score: null as number | null, notes: "" },
      { id: "lf2", item: "Living situation", score: null as number | null, notes: "" },
      { id: "lf3", item: "School achievement", score: null as number | null, notes: "" },
      { id: "lf4", item: "School behavior", score: null as number | null, notes: "" },
      { id: "lf5", item: "Social functioning", score: null as number | null, notes: "" },
      { id: "lf6", item: "Developmental/intellectual", score: null as number | null, notes: "" },
      { id: "lf7", item: "Sleep", score: null as number | null, notes: "" },
      { id: "lf8", item: "Independent living skills", score: null as number | null, notes: "" },
    ],
  },
  {
    name: "Youth Strengths",
    description: "Assets and protective factors",
    items: [
      { id: "ys1", item: "Family strengths", score: null as number | null, notes: "" },
      { id: "ys2", item: "Interpersonal skills", score: null as number | null, notes: "" },
      { id: "ys3", item: "Optimism", score: null as number | null, notes: "" },
      { id: "ys4", item: "Educational setting", score: null as number | null, notes: "" },
      { id: "ys5", item: "Vocational skills", score: null as number | null, notes: "" },
      { id: "ys6", item: "Problem-solving skills", score: null as number | null, notes: "" },
      { id: "ys7", item: "Natural supports", score: null as number | null, notes: "" },
      { id: "ys8", item: "Resiliency", score: null as number | null, notes: "" },
      { id: "ys9", item: "Resourcefulness", score: null as number | null, notes: "" },
    ],
  },
  {
    name: "Caregiver Needs & Strengths",
    description: "Caregiver capacity and resources",
    items: [
      { id: "cn1", item: "Supervision", score: null as number | null, notes: "" },
      { id: "cn2", item: "Knowledge of youth needs", score: null as number | null, notes: "" },
      { id: "cn3", item: "Social support", score: null as number | null, notes: "" },
      { id: "cn4", item: "Parental stress", score: null as number | null, notes: "" },
      { id: "cn5", item: "Marital/partner violence", score: null as number | null, notes: "" },
      { id: "cn6", item: "Legal involvement", score: null as number | null, notes: "" },
      { id: "cn7", item: "Physical health", score: null as number | null, notes: "" },
      { id: "cn8", item: "Mental health", score: null as number | null, notes: "" },
    ],
  },
  {
    name: "Child Behavioral & Emotional Needs",
    description: "Clinical and behavioral concerns",
    items: [
      { id: "cb1", item: "Psychosis", score: null as number | null, notes: "" },
      { id: "cb2", item: "Impulsivity/hyperactivity", score: null as number | null, notes: "" },
      { id: "cb3", item: "Depression", score: null as number | null, notes: "" },
      { id: "cb4", item: "Anxiety", score: null as number | null, notes: "" },
      { id: "cb5", item: "Oppositional behavior", score: null as number | null, notes: "" },
      { id: "cb6", item: "Conduct", score: null as number | null, notes: "" },
      { id: "cb7", item: "Substance use", score: null as number | null, notes: "" },
      { id: "cb8", item: "Attachment", score: null as number | null, notes: "" },
      { id: "cb9", item: "Anger control", score: null as number | null, notes: "" },
      { id: "cb10", item: "Eating disturbances", score: null as number | null, notes: "" },
    ],
  },
  {
    name: "Child Risk Behaviors",
    description: "Safety and risk indicators",
    items: [
      { id: "cr1", item: "Suicide risk", score: null as number | null, notes: "" },
      { id: "cr2", item: "Self-harm", score: null as number | null, notes: "" },
      { id: "cr3", item: "Danger to others", score: null as number | null, notes: "" },
      { id: "cr4", item: "Sexual aggression", score: null as number | null, notes: "" },
      { id: "cr5", item: "Fire setting", score: null as number | null, notes: "" },
      { id: "cr6", item: "Running away", score: null as number | null, notes: "" },
      { id: "cr7", item: "Delinquent behavior", score: null as number | null, notes: "" },
      { id: "cr8", item: "Exploitation (victim)", score: null as number | null, notes: "" },
    ],
  },
];

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "No evidence", color: "#059669", bg: "#ECFDF5" },
  1: { label: "Mild/Watch", color: "#D97706", bg: "#FFFBEB" },
  2: { label: "Moderate", color: "#DC2626", bg: "#FEF2F2" },
  3: { label: "Severe", color: "#7F1D1D", bg: "#FEE2E2" },
};

const ACTION_LEVELS = [
  { max: 0, label: "Action 0 — Routine monitoring", color: "#059669", bg: "#ECFDF5" },
  { max: 10, label: "Action 1 — Targeted intervention", color: "#D97706", bg: "#FFFBEB" },
  { max: 20, label: "Action 2 — Intensive services", color: "#DC2626", bg: "#FEF2F2" },
  { max: 999, label: "Action 3 — Immediate response", color: "#7F1D1D", bg: "#FEE2E2" },
];

export function CANSAssessmentPage() {
  const [domains, setDomains] = useState(CANS_DOMAINS);
  const [expandedDomain, setExpandedDomain] = useState<string | null>("Life Functioning");
  const [youthName, setYouthName] = useState("");
  const [assessorName, setAssessorName] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [saved, setSaved] = useState(false);

  const setScore = (domainIdx: number, itemIdx: number, score: number) => {
    const next = domains.map((d, di) => ({
      ...d,
      items: d.items.map((item, ii) =>
        di === domainIdx && ii === itemIdx ? { ...item, score } : item
      ),
    }));
    setDomains(next);
    setSaved(false);
  };

  const setNotes = (domainIdx: number, itemIdx: number, notes: string) => {
    const next = domains.map((d, di) => ({
      ...d,
      items: d.items.map((item, ii) =>
        di === domainIdx && ii === itemIdx ? { ...item, notes } : item
      ),
    }));
    setDomains(next);
    setSaved(false);
  };

  const resetAll = () => {
    setDomains(CANS_DOMAINS);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Scoring
  const allItems = domains.flatMap(d => d.items);
  const scoredItems = allItems.filter(i => i.score !== null);
  const totalScore = scoredItems.reduce((s, i) => s + (i.score ?? 0), 0);
  const avgScore = scoredItems.length > 0 ? (totalScore / scoredItems.length).toFixed(1) : "0.0";
  const completionPct = Math.round((scoredItems.length / allItems.length) * 100);

  // Domain averages
  const domainScores = domains.map(d => {
    const scored = d.items.filter(i => i.score !== null);
    const avg = scored.length > 0 ? (scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length).toFixed(1) : "—";
    const maxItem = scored.length > 0 ? Math.max(...scored.map(i => i.score ?? 0)) : 0;
    return { ...d, avg, maxItem, scored: scored.length, total: d.items.length };
  });

  // Action level
  const actionLevel = ACTION_LEVELS.find(a => totalScore <= a.max) || ACTION_LEVELS[0];

  // Risk flags (score 2-3 on risk items)
  const riskFlags = domains
    .filter(d => d.name === "Child Risk Behaviors")
    .flatMap(d => d.items)
    .filter(i => (i.score ?? 0) >= 2);

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={20} style={{ color: "#245C5A" }} />
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>CANS Assessment</h1>
          </div>
          <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
            Child and Adolescent Needs and Strengths — 43 items across 5 domains
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetAll} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-[11px] font-medium" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
            <Save size={12} /> {saved ? "Saved!" : "Save Assessment"}
          </button>
        </div>
      </div>

      {/* ─── Youth Info ────────────────────────────────── */}
      <div className="rounded-lg border p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth Name</label>
          <input value={youthName} onChange={e => setYouthName(e.target.value)} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "var(--card-border)" }} placeholder="Enter youth name" />
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Assessor</label>
          <input value={assessorName} onChange={e => setAssessorName(e.target.value)} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "var(--card-border)" }} placeholder="Enter assessor name" />
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Assessment Date</label>
          <input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "var(--card-border)" }} />
        </div>
      </div>

      {/* ─── Score Summary Banner ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Completion</div>
          <div className="text-[20px] font-bold" style={{ color: completionPct === 100 ? "#059669" : "#D97706" }}>{completionPct}%</div>
          <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{scoredItems.length}/{allItems.length} items</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Total Score</div>
          <div className="text-[20px] font-bold" style={{ color: actionLevel.color }}>{totalScore}</div>
          <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>of {allItems.length * 3} max</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Average</div>
          <div className="text-[20px] font-bold" style={{ color: parseFloat(avgScore) > 1.5 ? "#DC2626" : "#059669" }}>{avgScore}</div>
          <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>per item (0-3)</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: actionLevel.bg, borderColor: actionLevel.color + "40" }}>
          <div className="text-[10px] font-medium" style={{ color: actionLevel.color }}>Action Level</div>
          <div className="text-[14px] font-bold" style={{ color: actionLevel.color }}>{actionLevel.label}</div>
          <div className="text-[9px]" style={{ color: actionLevel.color }}>{riskFlags.length} risk flags</div>
        </div>
      </div>

      {/* ─── Risk Flags ────────────────────────────────── */}
      {riskFlags.length > 0 && (
        <div className="rounded-lg border p-3 mb-4" style={{ backgroundColor: "#FEF2F2", borderColor: "#fca5a5" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: "#DC2626" }} />
            <span className="text-[12px] font-bold" style={{ color: "#DC2626" }}>Risk Flags (Score 2-3)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskFlags.map(f => {
              const sl = SCORE_LABELS[f.score ?? 0];
              return (
                <span key={f.id} className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ backgroundColor: sl.bg, color: sl.color }}>
                  {f.item}: {sl.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Domain Accordion ──────────────────────────── */}
      <div className="space-y-2">
        {domains.map((domain, domainIdx) => {
          const ds = domainScores[domainIdx];
          const isExpanded = expandedDomain === domain.name;
          const hasHighScore = ds.maxItem >= 2;

          return (
            <div key={domain.name} className="rounded-lg border overflow-hidden" style={{ borderColor: hasHighScore ? "#fca5a5" : "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              {/* Domain Header */}
              <button
                onClick={() => setExpandedDomain(isExpanded ? null : domain.name)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hasHighScore ? "#FEF2F2" : "#f0f6f6" }}>
                  {hasHighScore ? <AlertTriangle size={14} style={{ color: "#DC2626" }} /> : <ClipboardCheck size={14} style={{ color: "#245C5A" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{domain.name}</span>
                    {hasHighScore && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>FLAG</span>}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{domain.description} • {ds.scored}/{ds.total} scored • Avg: {ds.avg}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[14px] font-bold" style={{ color: hasHighScore ? "#DC2626" : "#059669" }}>{ds.avg}</div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} /> : <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />}
                </div>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  {domain.items.map((item, itemIdx) => {
                    const sl = item.score !== null ? SCORE_LABELS[item.score] : null;
                    return (
                      <div key={item.id} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--card-border)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] font-medium flex-1" style={{ color: "var(--topbar-title)" }}>{item.item}</span>
                          {/* Score buttons */}
                          <div className="flex gap-1 flex-shrink-0">
                            {[0, 1, 2, 3].map(s => (
                              <button
                                key={s}
                                onClick={() => setScore(domainIdx, itemIdx, s)}
                                className="w-8 h-8 rounded text-[11px] font-bold border-2 transition-all"
                                style={{
                                  backgroundColor: item.score === s ? SCORE_LABELS[s].bg : "#fff",
                                  borderColor: item.score === s ? SCORE_LABELS[s].color : "#e2e8f0",
                                  color: item.score === s ? SCORE_LABELS[s].color : "#94a3b8",
                                }}
                                title={SCORE_LABELS[s].label}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Selected label */}
                        {sl && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: sl.bg, color: sl.color }}>{sl.label}</span>
                          </div>
                        )}
                        {/* Notes */}
                        <input
                          value={item.notes}
                          onChange={e => setNotes(domainIdx, itemIdx, e.target.value)}
                          className="w-full mt-1 px-2 py-1 rounded border text-[11px]"
                          style={{ borderColor: "#e2e8f0" }}
                          placeholder="Notes..."
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Score Reference ───────────────────────────── */}
      <div className="mt-4 rounded-lg border p-3" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
        <div className="text-[10px] font-medium mb-2" style={{ color: "var(--topbar-subtitle)" }}>SCORING REFERENCE</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: SCORE_LABELS[s].bg, color: SCORE_LABELS[s].color }}>{s}</div>
              <span className="text-[10px]" style={{ color: SCORE_LABELS[s].color }}>{SCORE_LABELS[s].label}</span>
            </div>
          ))}
        </div>
        <div className="text-[9px] mt-2" style={{ color: "var(--topbar-subtitle)" }}>
          Action Level thresholds: 0 = Action 0 (routine), 1-10 = Action 1 (targeted), 11-20 = Action 2 (intensive), 21+ = Action 3 (immediate)
        </div>
      </div>
    </div>
  );
}

export default CANSAssessmentPage;
