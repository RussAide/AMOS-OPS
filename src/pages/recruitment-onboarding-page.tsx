import { useState } from "react";
import { Users, Search, FileCheck, GraduationCap, Award, ShieldCheck, ChevronRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { PageLayout } from "@/components/shell/page-layout";

const TABS = [
  { key: "recruitment", label: "Recruitment", icon: Search },
  { key: "screening", label: "Screening", icon: FileCheck },
  { key: "offers", label: "Offers", icon: Award },
  { key: "orientation", label: "Orientation", icon: GraduationCap },
  { key: "training", label: "Training", icon: ShieldCheck },
  { key: "clearance", label: "Clearance", icon: ShieldCheck },
];

const candidates = [
  { id: "C-104", name: "Patricia Moore", role: "RCS - Day Shift", applied: "2026-06-28", status: "screening", source: "Indeed" },
  { id: "C-103", name: "James Wright", role: "Behavioral Support", applied: "2026-06-25", status: "interview", source: "Referral" },
  { id: "C-102", name: "Maria Garcia", role: "QMHP-CS", applied: "2026-06-20", status: "offer_pending", source: "LinkedIn" },
  { id: "C-101", name: "David Kim", role: "RCS - Night Shift", applied: "2026-06-15", status: "hired", source: "Indeed" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  screening: { bg: "#FFFBEB", color: "#B45309", label: "Screening" },
  interview: { bg: "#EFF6FF", color: "#2563EB", label: "Interview" },
  offer_pending: { bg: "#F5F3FF", color: "#7C3AED", label: "Offer Pending" },
  hired: { bg: "#ECFDF5", color: "#059669", label: "Hired" },
  rejected: { bg: "#FEF2F2", color: "#DC2626", label: "Rejected" },
};

const FUNNEL = [
  { stage: "Applications", count: 24, color: "#245C5A" },
  { stage: "Screening", count: 18, color: "#2563EB" },
  { stage: "Interview", count: 12, color: "#7C3AED" },
  { stage: "Offer", count: 6, color: "#D97706" },
  { stage: "Hired", count: 4, color: "#059669" },
];

const TRAINING_ITEMS = [
  { name: "HIPAA & PHI Protection", required: true, completed: 38, total: 42, due: "2026-07-15" },
  { name: "Crisis De-escalation", required: true, completed: 35, total: 42, due: "2026-07-20" },
  { name: "Medication Administration", required: true, completed: 28, total: 42, due: "2026-07-30" },
  { name: "CANS Assessment Basics", required: false, completed: 15, total: 42, due: "2026-08-15" },
  { name: "Trauma-Informed Care", required: true, completed: 40, total: 42, due: "2026-07-10" },
];

const CLEARANCE_ITEMS = [
  { name: "Background Check", status: "cleared", date: "2026-06-15" },
  { name: "TB Test", status: "cleared", date: "2026-06-10" },
  { name: "Fingerprinting", status: "pending", date: null },
  { name: "DHHS Central Registry", status: "cleared", date: "2026-06-12" },
  { name: "Driver Record Check", status: "not_required", date: null },
];

export function RecruitmentOnboardingPage() {
  const [activeTab, setActiveTab] = useState("recruitment");

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">

      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--card-border)" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors flex-shrink-0" style={{ borderColor: activeTab === tab.key ? "#245C5A" : "transparent", color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)" }}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "recruitment" && (
        <div>
          <div className="flex gap-3 mb-4">
            {FUNNEL.map(f => (
              <div key={f.stage} className="flex-1 rounded-lg border p-2 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="text-[16px] font-bold" style={{ color: f.color }}>{f.count}</div>
                <div className="text-[9px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{f.stage}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {candidates.map(c => {
              const st = STATUS_COLORS[c.status] || STATUS_COLORS.screening;
              return (
                <div key={c.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                    <Users size={15} style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>{c.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.role} &middot; {c.source} &middot; Applied {new Date(c.applied).toLocaleDateString()}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "screening" && (
        <div className="text-center py-12">
          <FileCheck size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Screening workflows — background check triggers, reference verification, credential validation</p>
        </div>
      )}

      {activeTab === "offers" && (
        <div className="text-center py-12">
          <Award size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Offer letter generation, acceptance tracking, pre-employment paperwork</p>
        </div>
      )}

      {activeTab === "orientation" && (
        <div className="text-center py-12">
          <GraduationCap size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Orientation scheduling, module assignment, completion tracking</p>
        </div>
      )}

      {activeTab === "training" && (
        <div className="space-y-2">
          {TRAINING_ITEMS.map(t => {
            const pct = Math.round((t.completed / t.total) * 100);
            return (
              <div key={t.name} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{t.name}</span>
                    {t.required && <span className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Required</span>}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: pct === 100 ? "#059669" : "#D97706" }}>{t.completed}/{t.total} ({pct}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#059669" : "#245C5A" }} />
                </div>
                <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Due: {new Date(t.due).toLocaleDateString()}</div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "clearance" && (
        <div className="space-y-2">
          {CLEARANCE_ITEMS.map(c => (
            <div key={c.name} className="rounded-lg border p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.status === "cleared" ? "#ECFDF5" : c.status === "pending" ? "#FFFBEB" : "#f1f5f9" }}>
                {c.status === "cleared" ? <CheckCircle2 size={14} style={{ color: "#059669" }} /> : c.status === "pending" ? <Clock size={14} style={{ color: "#D97706" }} /> : <XCircle size={14} style={{ color: "#94a3b8" }} />}
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.name}</div>
                <div className="text-[10px]" style={{ color: c.status === "cleared" ? "#059669" : c.status === "pending" ? "#D97706" : "var(--topbar-subtitle)" }}>
                  {c.status === "cleared" ? `Cleared ${c.date}` : c.status === "pending" ? "Pending" : "Not Required"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </PageLayout>
  );
}

export default RecruitmentOnboardingPage;
