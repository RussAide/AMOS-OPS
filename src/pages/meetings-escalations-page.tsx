import { useState } from "react";
import { CalendarDays, MessageSquareWarning, ChevronRight, Clock, User, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { PageLayout } from "@/components/shell/page-layout";

const TABS = [
  { key: "meetings", label: "Meeting Cadence", icon: CalendarDays },
  { key: "escalations", label: "Escalation Ladder", icon: MessageSquareWarning },
];

const meetings = [
  { id: "M-001", title: "Weekly MDT Review", type: "MDT", date: "2026-07-03", time: "10:00 AM", attendees: ["Dr. Hall", "Sarah RCS", "QMHP-CS"], status: "scheduled", actionItems: 3 },
  { id: "M-002", title: "Family Conference — Johnson", type: "Family", date: "2026-07-02", time: "2:00 PM", attendees: ["Case Manager", "Guardian"], status: "completed", actionItems: 2 },
  { id: "M-003", title: "GRO Shift Handoff", type: "Shift", date: "2026-07-02", time: "6:00 PM", attendees: ["RCS Day", "RCS Night"], status: "completed", actionItems: 0 },
  { id: "M-004", title: "Crisis Debrief — IR-2026-0701-004", type: "Crisis", date: "2026-07-02", time: "9:00 AM", attendees: ["Dr. Hall", "Supervisor", "RCS Lead"], status: "completed", actionItems: 4 },
];

const escalations = [
  { id: "ESC-003", level: 1, title: "Youth refused medication", trigger: "Medication refusal x1", responder: "RCS On-Duty", action: "Attempt re-offer, document reason", sla: "15 min", status: "resolved", resolvedAt: "2026-07-02 20:30" },
  { id: "ESC-002", level: 2, title: "Verbal aggression during group", trigger: "Threatening language toward peer", responder: "RCS Lead + Behavioral Support", action: "De-escalation, 1:1 supervision, incident report", sla: "30 min", status: "resolved", resolvedAt: "2026-07-01 15:00" },
  { id: "ESC-001", level: 3, title: "Physical altercation — IR-2026-0701-004", trigger: "Physical contact between youth", responder: "On-Call Clinician + Program Director", action: "Physical separation, safety check, clinical assessment, debrief", sla: "Immediate", status: "resolved", resolvedAt: "2026-07-01 15:00" },
];

export function MeetingsEscalationsPage() {
  const [activeTab, setActiveTab] = useState("meetings");

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

      {activeTab === "meetings" && (
        <div className="space-y-2">
          {meetings.map(m => (
            <div key={m.id} className="rounded-lg border p-4 flex items-start gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.status === "completed" ? "#ECFDF5" : "#EFF6FF" }}>
                <CalendarDays size={18} style={{ color: m.status === "completed" ? "#059669" : "#2563EB" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{m.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{m.type}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: m.status === "completed" ? "#ECFDF5" : "#EFF6FF", color: m.status === "completed" ? "#059669" : "#2563EB" }}>{m.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span>{new Date(m.date).toLocaleDateString()} at {m.time}</span>
                  <span className="flex items-center gap-1"><Users size={10} /> {m.attendees.length} attendees</span>
                  {m.actionItems > 0 && <span style={{ color: "#D97706" }}>{m.actionItems} action items</span>}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--topbar-subtitle)" }} className="flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "escalations" && (
        <div>
          <div className="rounded-lg border p-3 mb-4" style={{ backgroundColor: "#FFFBEB", borderColor: "#fcd34d" }}>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "#B45309" }}>
              <AlertTriangle size={14} />
              <span><strong>Escalation Protocol:</strong> Level 1 (RCS) → Level 2 (RCS Lead) → Level 3 (On-Call Clinician) → Level 4 (Program Director) → Level 5 (Administrator/LCCA)</span>
            </div>
          </div>
          <div className="space-y-2">
            {escalations.map(e => (
              <div key={e.id} className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: e.level >= 3 ? "#fca5a5" : "var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-bold" style={{ backgroundColor: e.level >= 3 ? "#FEF2F2" : "#EFF6FF", color: e.level >= 3 ? "#DC2626" : "#2563EB" }}>
                    L{e.level}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{e.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>Trigger: {e.trigger}</div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>Responder: <strong>{e.responder}</strong></span>
                      <span style={{ color: "var(--topbar-subtitle)" }}>SLA: <strong>{e.sla}</strong></span>
                      <span className="flex items-center gap-1" style={{ color: "#059669" }}><CheckCircle2 size={10} /> Resolved {e.resolvedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 p-2 rounded text-[11px]" style={{ backgroundColor: "#f8fafc" }}>
                  <strong>Action:</strong> {e.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}

export default MeetingsEscalationsPage;
