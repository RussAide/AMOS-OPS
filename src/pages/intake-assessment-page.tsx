import { useState } from "react";
import {
  UserPlus, ClipboardCheck, Brain, ChevronRight,
} from "lucide-react";
import { PageLayout } from "@/components/shell/page-layout";

const TABS = [
  { key: "intake", label: "Referral Intake", icon: UserPlus },
  { key: "assessment", label: "Clinical Assessment", icon: ClipboardCheck },
  { key: "cans", label: "CANS Scoring", icon: Brain },
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#FFFBEB", color: "#B45309" },
  active: { bg: "#ECFDF5", color: "#059669" },
  urgent: { bg: "#FEF2F2", color: "#DC2626" },
  completed: { bg: "#EFF6FF", color: "#2563EB" },
};

const referrals = [
  { id: "REF-2026-007", name: "Synthetic-Person-019 Mitchell", age: 15, referred: "2026-07-01", status: "pending", source: "DFPS", assigned: "Demo Clinical Director", urgency: "high", type: "Residential" },
  { id: "REF-2026-006", name: "Taylor Brooks", age: 14, referred: "2026-06-28", status: "active", source: "Hospital", assigned: "Synthetic Staff 01", urgency: "medium", type: "Crisis" },
  { id: "REF-2026-005", name: "Riley Chen", age: 16, referred: "2026-06-20", status: "completed", source: "School", assigned: "Synthetic Staff 02", urgency: "low", type: "Outpatient" },
];

const assessments = [
  { id: "ASM-004", youth: "Synthetic Youth 002", mrn: "SYNTH-BHC-004", type: "Intake", clinician: "Demo Clinical Director", date: "2026-06-30", status: "in_progress", score: null },
  { id: "ASM-003", youth: "Synthetic Youth 007", mrn: "SYNTH-BHC-003", type: "30-Day Review", clinician: "Demo Clinical Director", date: "2026-06-28", status: "completed", score: 42 },
  { id: "ASM-002", youth: "Synthetic Youth 005", mrn: "SYNTH-BHC-002", type: "Intake", clinician: "QMHP-CS", date: "2026-04-12", status: "completed", score: 38 },
  { id: "ASM-001", youth: "Synthetic Youth 001", mrn: "SYNTH-BHC-001", type: "Intake", clinician: "Demo Clinical Director", date: "2026-04-05", status: "completed", score: 45 },
];

const CANS_DOMAINS = [
  { domain: "Functioning", score: 22, risk: "low" },
  { domain: "Risk Behaviors", score: 18, risk: "moderate" },
  { domain: "Behavioral/Emotional Needs", score: 24, risk: "moderate" },
  { domain: "Trauma Experiences", score: 28, risk: "high" },
  { domain: "Substance Use", score: 12, risk: "low" },
  { domain: "Strengths", score: 20, risk: "low" },
];

export function IntakeAssessmentPage() {
  const [activeTab, setActiveTab] = useState("intake");
  const [intakeFilter, setIntakeFilter] = useState("all");

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">

      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors flex-shrink-0" style={{ borderColor: activeTab === tab.key ? "#245C5A" : "transparent", color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)" }}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "intake" && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "pending", "active", "completed", "urgent"].map(f => (
              <button key={f} onClick={() => setIntakeFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize" style={{ backgroundColor: intakeFilter === f ? "#245C5A" : "var(--card-bg)", borderColor: intakeFilter === f ? "#245C5A" : "var(--card-border)", color: intakeFilter === f ? "#fff" : "var(--topbar-subtitle)" }}>{f === "all" ? "All" : f}</button>
            ))}
            <span className="ml-auto text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{referrals.length} referrals</span>
          </div>
          <div className="space-y-2">
            {referrals.map(r => {
              const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
              return (
                <div key={r.id} className="rounded-lg border p-4 flex items-start gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                    <UserPlus size={18} style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{r.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{r.status}</span>
                      {r.urgency === "high" && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>High Priority</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      <span>Age: {r.age}</span>
                      <span>Source: {r.source}</span>
                      <span>Type: {r.type}</span>
                      <span>Assigned: {r.assigned}</span>
                      <span>Referred: {new Date(r.referred).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className="text-[10px] px-3 py-1.5 rounded font-medium text-white flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>Open</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "assessment" && (
        <div className="space-y-2">
          {assessments.map(a => (
            <div key={a.id} className="rounded-lg border p-4 flex items-start gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.status === "completed" ? "#ECFDF5" : "#FFFBEB" }}>
                <ClipboardCheck size={18} style={{ color: a.status === "completed" ? "#059669" : "#B45309" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{a.youth}</span>
                  <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{a.mrn}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: a.status === "completed" ? "#ECFDF5" : "#FFFBEB", color: a.status === "completed" ? "#059669" : "#B45309" }}>{a.status === "completed" ? "Completed" : "In Progress"}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span>{a.type}</span>
                  <span>Clinician: {a.clinician}</span>
                  <span>Date: {new Date(a.date).toLocaleDateString()}</span>
                  {a.score !== null && <span className="font-medium" style={{ color: "#245C5A" }}>Score: {a.score}</span>}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--topbar-subtitle)" }} className="flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "cans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CANS_DOMAINS.map(d => (
              <div key={d.domain} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: d.risk === "high" ? "#fca5a5" : "var(--card-border)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{d.domain}</div>
                <div className="text-[22px] font-bold mt-1" style={{ color: d.risk === "high" ? "#DC2626" : d.risk === "moderate" ? "#B45309" : "#059669" }}>{d.score}</div>
                <div className="text-[10px] mt-1" style={{ color: d.risk === "high" ? "#DC2626" : d.risk === "moderate" ? "#B45309" : "#059669" }}>{d.risk} risk</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border p-4 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Total CANS Score</div>
            <div className="text-[36px] font-black mt-1" style={{ color: "#245C5A" }}>124</div>
            <div className="text-[12px]" style={{ color: "#B45309" }}>Moderate overall risk — Review recommended</div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}

export default IntakeAssessmentPage;
