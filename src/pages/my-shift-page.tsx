import { useState, useEffect } from "react";
import {
  Sun, Moon, Pill, ClipboardList, Phone, AlertTriangle, FileText,
  CheckCircle2, Circle, ChevronRight, ChevronDown, Clock, Users,
  ShieldCheck, MessageSquare, Activity, Handshake, LogOut, LogIn,
  Utensils, BookOpen, Sparkles
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/shell/page-layout";

// ═══════════════════════════════════════════════════════════════
// SHIFT SCHEDULE — Real Day Shift (7:00 AM - 3:00 PM)
// ═══════════════════════════════════════════════════════════════

interface ShiftActivity {
  id: string;
  time: string;
  endTime: string;
  title: string;
  description: string;
  icon: any;
  type: "medpass" | "observation" | "supervision" | "contact" | "documentation" | "count" | "handoff" | "clock";
  relatedYouth?: string[];
  items?: ShiftItem[];
}

interface ShiftItem {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  proof?: string;
  youthName?: string;
  medId?: string;
}

const SHIFT_ACTIVITIES: ShiftActivity[] = [
  {
    id: "clock-in", time: "07:00", endTime: "07:15", title: "Clock In & Shift Briefing",
    description: "Review overnight handoff, check assigned youth, confirm shift coverage",
    icon: LogIn, type: "clock",
    items: [
      { id: "ci-1", label: "Read overnight handoff note from Tanya Reyes (Night Lead)", status: "pending" },
      { id: "ci-2", label: "Confirm assigned youth: Marcus, Aaliyah, Carlos, Jada, Tyrell", status: "pending" },
      { id: "ci-3", label: "Verify shift coverage: 3 RCS staff + RN Martinez on duty", status: "pending" },
      { id: "ci-4", label: "Check for alerts: Sierra Harris — safety watch, Nia Robinson — new admission", status: "pending" },
    ],
  },
  {
    id: "am-med", time: "07:30", endTime: "09:00", title: "AM Medication Pass",
    description: "Administer morning medications to all 16 youth. Document refusals, PRNs, and controlled substances.",
    icon: Pill, type: "medpass", relatedYouth: ["y1","y2","y3","y4","y5","y6","y7","y8","y9","y10","y11","y12","y13","y14","y15","y16"],
    items: [
      { id: "am-1", label: "Fluoxetine 20mg — Marcus Johnson", status: "pending", youthName: "Marcus Johnson", medId: "med1" },
      { id: "am-2", label: "Lisdexamfetamine 30mg — Aaliyah Williams (C-II, witnessed waste)", status: "pending", youthName: "Aaliyah Williams", medId: "med4" },
      { id: "am-3", label: "Methylphenidate 10mg — Carlos Martinez (C-II, witnessed waste)", status: "pending", youthName: "Carlos Martinez", medId: "med6" },
      { id: "am-4", label: "Risperidone 1mg — Jada Thompson", status: "pending", youthName: "Jada Thompson", medId: "med8" },
      { id: "am-5", label: "Sertraline 50mg — Tyrell Jackson", status: "pending", youthName: "Tyrell Jackson", medId: "med11" },
      { id: "am-6", label: "Fluoxetine 10mg + Guanfacine 2mg — Destiny Brown", status: "pending", youthName: "Destiny Brown", medId: "med13" },
      { id: "am-7", label: "Atomoxetine 40mg — Elijah Davis (re-offer, refused earlier)", status: "pending", youthName: "Elijah Davis", medId: "med15" },
      { id: "am-8", label: "Lamotrigine 100mg — Makayla Wilson", status: "pending", youthName: "Makayla Wilson", medId: "med17" },
      { id: "am-9", label: "Methylphenidate 20mg — Jordan Garcia (C-II, witnessed waste)", status: "pending", youthName: "Jordan Garcia", medId: "med19" },
      { id: "am-10", label: "Sertraline 25mg — Imani Lee", status: "pending", youthName: "Imani Lee", medId: "med21" },
      { id: "am-11", label: "Methylphenidate 5mg — Cameron Taylor (C-II, witnessed waste)", status: "pending", youthName: "Cameron Taylor", medId: "med23" },
      { id: "am-12", label: "Lithium 300mg — Sierra Harris (BID, level check due Friday)", status: "pending", youthName: "Sierra Harris", medId: "med25" },
      { id: "am-13", label: "Fluoxetine 20mg — Devon Clark", status: "pending", youthName: "Devon Clark", medId: "med27" },
      { id: "am-14", label: "Lamotrigine 50mg — Ariana Lewis", status: "pending", youthName: "Ariana Lewis", medId: "med29" },
      { id: "am-15", label: "Methylphenidate 10mg — Isaiah Walker (C-II, witnessed waste)", status: "pending", youthName: "Isaiah Walker", medId: "med31" },
      { id: "am-16", label: "Document controlled substance count — 5 C-II meds", status: "pending" },
    ],
  },
  {
    id: "breakfast", time: "08:00", endTime: "09:00", title: "Breakfast Supervision",
    description: "Supervise youth during breakfast. Monitor for behavioral concerns. Logan observations as needed.",
    icon: Utensils, type: "supervision", relatedYouth: ["y1","y2","y3","y4","y5","y6","y7","y8","y9","y10","y11","y12","y13","y14","y15","y16"],
    items: [
      { id: "bf-1", label: "Check dining hall headcount (all 16 present)", status: "pending" },
      { id: "bf-2", label: "Observe Jada Thompson — monitor for peer interactions post-incident", status: "pending" },
      { id: "bf-3", label: "Check Sierra Harris — 1:1 supervision per safety plan", status: "pending" },
      { id: "bf-4", label: "Re-offer multivitamin to Marcus Johnson (refused at med pass)", status: "pending" },
      { id: "bf-5", label: "Log behavioral observation — any concerns during meal", status: "pending" },
    ],
  },
  {
    id: "morning-obs", time: "09:00", endTime: "11:00", title: "Morning Activities & Observations",
    description: "Supervise morning group activities. Complete 6-domain behavioral observations for assigned youth.",
    icon: ClipboardList, type: "observation", relatedYouth: ["y1","y2","y3","y4","y5"],
    items: [
      { id: "mo-1", label: "6-domain observation — Marcus Johnson", status: "pending", youthName: "Marcus Johnson" },
      { id: "mo-2", label: "6-domain observation — Aaliyah Williams", status: "pending", youthName: "Aaliyah Williams" },
      { id: "mo-3", label: "6-domain observation — Carlos Martinez", status: "pending", youthName: "Carlos Martinez" },
      { id: "mo-4", label: "6-domain observation — Jada Thompson (priority: post-incident)", status: "pending", youthName: "Jada Thompson" },
      { id: "mo-5", label: "6-domain observation — Tyrell Jackson", status: "pending", youthName: "Tyrell Jackson" },
    ],
  },
  {
    id: "family-calls", time: "10:00", endTime: "11:00", title: "Family Contact Window",
    description: "Make scheduled guardian phone calls. Document topics discussed, concerns, and follow-up actions.",
    icon: Phone, type: "contact",
    items: [
      { id: "fc-1", label: "Phone call — Destiny Brown's mother (Angela) re: discharge planning meeting 7/10", status: "pending" },
      { id: "fc-2", label: "Phone call — Elijah Davis's mother (Patricia) re: video call options for weekends", status: "pending" },
      { id: "fc-3", label: "Phone call — Sierra Harris's mother (Tamara) — FOLLOW-UP: emergency family meeting 7/4", status: "pending" },
      { id: "fc-4", label: "Log letter from Sharon Jackson (Tyrell's mother)", status: "pending" },
    ],
  },
  {
    id: "mid-med", time: "11:00", endTime: "12:00", title: "Mid-Day Medication Pass",
    description: "BID medications and any PRN administrations. Re-offer refused meds.",
    icon: Pill, type: "medpass", relatedYouth: ["y4","y12"],
    items: [
      { id: "mm-1", label: "Risperidone 1mg — Jada Thompson (BID, evening dose pre-administered?)", status: "pending", youthName: "Jada Thompson", medId: "med9" },
      { id: "mm-2", label: "Lithium 300mg — Sierra Harris (BID)", status: "pending", youthName: "Sierra Harris", medId: "med26" },
      { id: "mm-3", label: "Re-offer refused meds from AM pass", status: "pending" },
      { id: "mm-4", label: "Check PRN availability — Hydroxyzine for Jada if needed", status: "pending" },
    ],
  },
  {
    id: "lunch", time: "12:00", endTime: "13:00", title: "Lunch Supervision",
    description: "Supervise lunch. High-priority observation period — peer interactions are closely monitored.",
    icon: Utensils, type: "supervision",
    items: [
      { id: "lu-1", label: "Dining hall headcount and seating arrangement", status: "pending" },
      { id: "lu-2", label: "Monitor Jada Thompson peer interactions (post-altercation)", status: "pending" },
      { id: "lu-3", label: "Support Nia Robinson — first group meal, encourage engagement", status: "pending" },
      { id: "lu-4", label: "Log any behavioral concerns", status: "pending" },
    ],
  },
  {
    id: "afternoon", time: "13:00", endTime: "14:30", title: "Afternoon Activities & Documentation",
    description: "Recreation, therapy support, and catching up on documentation.",
    icon: Activity, type: "documentation",
    items: [
      { id: "af-1", label: "Submit formal incident report — Elijah Davis property damage", status: "pending" },
      { id: "af-2", label: "Complete restitution plan documentation — Elijah Davis", status: "pending" },
      { id: "af-3", label: "Weekly case staffing prep — Dr. Hall's assigned youth notes", status: "pending" },
      { id: "af-4", label: "PRN documentation review — Jada Thompson Hydroxyzine effectiveness", status: "pending" },
    ],
  },
  {
    id: "controlled-count", time: "14:30", endTime: "15:00", title: "Controlled Substance Count & Shift Close",
    description: "Verify controlled medication counts with co-worker. Sign off. Document any discrepancies.",
    icon: ShieldCheck, type: "count",
    items: [
      { id: "cc-1", label: "Count Lisdexamfetamine (Aaliyah) — verify bottle count", status: "pending" },
      { id: "cc-2", label: "Count Methylphenidate — Carlos, Jordan, Cameron, Isaiah (4 bottles)", status: "pending" },
      { id: "cc-3", label: "Verify waste records match MAR entries", status: "pending" },
      { id: "cc-4", label: "Co-sign with RN Martinez", status: "pending" },
    ],
  },
  {
    id: "handoff", time: "14:45", endTime: "15:00", title: "Shift Handoff to Evening Staff",
    description: "Write handoff note for David Park (Evening Lead). Include alerts, outstanding items, and youth status.",
    icon: Handshake, type: "handoff",
    items: [
      { id: "ho-1", label: "Write handoff note — youth status summaries", status: "pending" },
      { id: "ho-2", label: "Flag ALERT: Sierra Harris — ongoing safety watch, clinician session 7/4", status: "pending" },
      { id: "ho-3", label: "Flag ALERT: Nia Robinson — new admission, still isolating, peer buddy assigned", status: "pending" },
      { id: "ho-4", label: "Flag ALERT: Jada Thompson — post-incident, behavior plan review pending", status: "pending" },
      { id: "ho-5", label: "Outstanding: Family meeting 7/4 for Sierra, discharge planning 7/10 for Destiny", status: "pending" },
    ],
  },
  {
    id: "clock-out", time: "15:00", endTime: "15:00", title: "Clock Out",
    description: "Review completed tasks. Confirm all documentation submitted. Sign off shift.",
    icon: LogOut, type: "clock",
    items: [
      { id: "co-1", label: "Review shift summary — completed tasks, pending handoffs", status: "pending" },
      { id: "co-2", label: "Confirm all med pass documentation complete", status: "pending" },
      { id: "co-3", label: "Sign off shift", status: "pending" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function MyShiftPage() {
  const [activities, setActivities] = useState<ShiftActivity[]>(SHIFT_ACTIVITIES);
  const [expandedActivity, setExpandedActivity] = useState<string>("am-med");
  const [selectedYouthId, setSelectedYouthId] = useState<string>("");
  const [obsFormOpen, setObsFormOpen] = useState(false);
  const [obsForm, setObsForm] = useState({ domain1: 0, domain2: 0, domain3: 0, domain4: 0, domain5: 0, domain6: 0, notes: "" });
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ type: "phone_call", person: "", relationship: "", topics: "", concerns: "" });
  const [handoffFormOpen, setHandoffFormOpen] = useState(false);
  const [handoffNote, setHandoffNote] = useState("");

  // Live data
  const utils = trpc.useUtils();
  const { data: medications = [] } = trpc.m19.listMedications.useQuery();
  const { data: medSummary } = trpc.m19.medSummary.useQuery();
  const { data: youthList = [] } = trpc.m13.listYouth.useQuery();
  const { data: behavioralObs = [] } = trpc.m18.listBehavioralObs.useQuery();
  const { data: familyContacts = [] } = trpc.m18.listFamilyContacts.useQuery();

  // Mutations
  const adminMed = trpc.m19.administer.useMutation({ onSuccess: () => { utils.m19.listMedications.invalidate(); utils.m19.medSummary.invalidate(); } });
  const refuseMed = trpc.m19.recordRefusal.useMutation({ onSuccess: () => { utils.m19.listMedications.invalidate(); utils.m19.medSummary.invalidate(); } });
  const holdMedMut = trpc.m19.holdMedication.useMutation({ onSuccess: () => { utils.m19.listMedications.invalidate(); utils.m19.medSummary.invalidate(); } });
  const createObs = trpc.m18.createBehavioralObs.useMutation({ onSuccess: () => { utils.m18.listBehavioralObs.invalidate(); setObsFormOpen(false); setObsForm({ domain1: 0, domain2: 0, domain3: 0, domain4: 0, domain5: 0, domain6: 0, notes: "" }); } });
  const createContact = trpc.m18.createFamilyContact.useMutation({ onSuccess: () => { utils.m18.listFamilyContacts.invalidate(); setContactFormOpen(false); setContactForm({ type: "phone_call", person: "", relationship: "", topics: "", concerns: "" }); } });

  // Toggle item completion
  const toggleItem = (activityId: string, itemId: string) => {
    setActivities(prev => prev.map(a => {
      if (a.id !== activityId) return a;
      return { ...a, items: a.items?.map(i => i.id === itemId ? { ...i, status: i.status === "completed" ? "pending" : "completed" } : i) };
    }));
  };

  // Get med status from live store
  const getMedStatus = (medId?: string) => {
    if (!medId) return null;
    return medications.find((m: any) => m.id === medId)?.status || "scheduled";
  };

  // Calculate overall progress
  const totalItems = activities.reduce((sum, a) => sum + (a.items?.length || 0), 0);
  const completedItems = activities.reduce((sum, a) => sum + (a.items?.filter(i => i.status === "completed").length || 0), 0);
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Current activity based on time (simulated as 8:00 AM for demo)
  const currentHour = 8; // Simulated: 8:00 AM
  const currentActivity = activities.find(a => {
    const start = parseInt(a.time.split(":")[0]);
    const end = parseInt(a.endTime.split(":")[0]);
    return currentHour >= start && currentHour < end;
  }) || activities[1];

  const DOMAIN_LABELS = ["Safety", "Emotional Regulation", "Daily Functioning", "Medication Compliance", "Social Relationships", "Program Participation"];

  return (
    <PageLayout category="RESIDENTIAL" title="My Shift" subtitle="Day Shift — July 3, 2026 | 7:00 AM - 3:00 PM">
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-5xl mx-auto">

        {/* ═══ SHIFT HEADER ═══ */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "linear-gradient(135deg, #1a3a38, #245C5A)", color: "#fff" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sun size={18} style={{ color: "#7EC8CA" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7EC8CA" }}>Day Shift</span>
                <span className="text-[11px] opacity-60">|</span>
                <span className="text-[11px] opacity-60">Sarah Johnson — RCS Lead</span>
              </div>
              <h2 className="text-[18px] font-bold">July 3, 2026 — 7:00 AM to 3:00 PM</h2>
              <p className="text-[12px] mt-1 opacity-80">Assigned youth: Marcus, Aaliyah, Carlos, Jada, Tyrell</p>
            </div>
            <div className="text-right">
              <div className="text-[32px] font-bold" style={{ color: "#7EC8CA" }}>{progress}%</div>
              <div className="text-[10px] uppercase tracking-wider opacity-70">Shift Complete</div>
              <div className="text-[11px] mt-1">{completedItems} of {totalItems} items done</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full mt-4" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: "#7EC8CA" }} />
          </div>

          {/* Live stats */}
          <div className="flex gap-6 mt-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Pill size={14} style={{ color: "#7EC8CA" }} />
              <span className="text-[11px]">{medSummary?.administered || 0} meds given</span>
            </div>
            <div className="flex items-center gap-2">
              <ClipboardList size={14} style={{ color: "#7EC8CA" }} />
              <span className="text-[11px]">{behavioralObs.length} observations logged</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} style={{ color: "#7EC8CA" }} />
              <span className="text-[11px]">{familyContacts.length} family contacts</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: "#7EC8CA" }} />
              <span className="text-[11px]">2 alerts active</span>
            </div>
          </div>
        </div>

        {/* ═══ CURRENT ACTIVITY BANNER ═══ */}
        {currentActivity && (
          <div className="rounded-lg border-l-4 p-4 mb-6 flex items-center gap-3" style={{ backgroundColor: "#fefce8", borderColor: "#D97706" }}>
            <Clock size={18} style={{ color: "#D97706" }} />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#D97706" }}>Current Activity</span>
              <p className="text-[13px] font-medium" style={{ color: "#1B4D4F" }}>{currentActivity.time} — {currentActivity.title}</p>
            </div>
          </div>
        )}

        {/* ═══ SHIFT TIMELINE ═══ */}
        <div className="space-y-3">
          {activities.map((activity) => {
            const isExpanded = expandedActivity === activity.id;
            const actCompleted = activity.items?.filter(i => i.status === "completed").length || 0;
            const actTotal = activity.items?.length || 0;
            const isDone = actCompleted === actTotal && actTotal > 0;
            const Icon = activity.icon;
            const isCurrent = currentActivity?.id === activity.id;

            const typeColors: Record<string, string> = {
              medpass: "#2563EB", observation: "#7C3AED", supervision: "#059669",
              contact: "#0891B2", documentation: "#D97706", count: "#DC2626",
              handoff: "#245C5A", clock: "#64748b",
            };

            return (
              <div key={activity.id} className="rounded-lg border overflow-hidden" style={{ borderColor: isCurrent ? "#D97706" : "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                {/* Activity Header */}
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 text-left border-none"
                  style={{ backgroundColor: isCurrent ? "#fefce8" : "var(--card-bg)", cursor: "pointer" }}
                  onClick={() => setExpandedActivity(isExpanded ? "" : activity.id)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (typeColors[activity.type] || "#64748b") + "15" }}>
                    <Icon size={16} style={{ color: typeColors[activity.type] || "#64748b" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: "var(--topbar-title)" }}>{activity.time} — {activity.title}</span>
                      {isDone && <CheckCircle2 size={14} style={{ color: "#059669" }} />}
                      {isCurrent && <Badge className="text-[9px] h-5" style={{ backgroundColor: "#fef3c7", color: "#D97706" }}>Current</Badge>}
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "var(--topbar-subtitle)" }}>{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-medium" style={{ color: actCompleted === actTotal ? "#059669" : "var(--topbar-subtitle)" }}>{actCompleted}/{actTotal}</span>
                    {isExpanded ? <ChevronDown size={16} style={{ color: "var(--topbar-subtitle)" }} /> : <ChevronRight size={16} style={{ color: "var(--topbar-subtitle)" }} />}
                  </div>
                </button>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                    {/* Quick action buttons for observation activities */}
                    {activity.type === "observation" && (
                      <div className="flex gap-2 mb-3">
                        <Button size="sm" className="text-[10px] h-7 bg-[#7C3AED] hover:bg-[#5b21b6] text-white" onClick={() => setObsFormOpen(!obsFormOpen)}>
                          <ClipboardList size={12} className="mr-1" /> Log Observation
                        </Button>
                      </div>
                    )}
                    {activity.type === "contact" && (
                      <div className="flex gap-2 mb-3">
                        <Button size="sm" className="text-[10px] h-7 bg-[#0891B2] hover:bg-[#0e7490] text-white" onClick={() => setContactFormOpen(!contactFormOpen)}>
                          <Phone size={12} className="mr-1" /> Log Family Contact
                        </Button>
                      </div>
                    )}
                    {activity.type === "handoff" && (
                      <div className="flex gap-2 mb-3">
                        <Button size="sm" className="text-[10px] h-7 bg-[#245C5A] hover:bg-[#1a3a38] text-white" onClick={() => setHandoffFormOpen(!handoffFormOpen)}>
                          <FileText size={12} className="mr-1" /> Write Handoff Note
                        </Button>
                      </div>
                    )}

                    {/* Observation Form */}
                    {obsFormOpen && activity.type === "observation" && (
                      <div className="rounded-lg border p-4 mb-3" style={{ backgroundColor: "#faf5ff", borderColor: "#e9d5ff" }}>
                        <h4 className="text-[12px] font-semibold mb-3" style={{ color: "#7C3AED" }}>New Behavioral Observation</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Youth</label>
                            <select className="w-full text-[11px] border rounded px-2 py-1" value={selectedYouthId} onChange={e => setSelectedYouthId(e.target.value)}>
                              <option value="">Select youth...</option>
                              {youthList.map((y: any) => <option key={y.id} value={y.id}>{y.first_name} {y.last_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Observed By</label>
                            <input className="w-full text-[11px] border rounded px-2 py-1" value="Sarah Johnson" readOnly />
                          </div>
                        </div>
                        {DOMAIN_LABELS.map((label, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] w-32" style={{ color: "var(--topbar-subtitle)" }}>{label}</span>
                            <input type="range" min={0} max={3} className="flex-1 h-1" value={(obsForm as any)[`domain${idx + 1}`]} onChange={e => setObsForm({ ...obsForm, [`domain${idx + 1}`]: parseInt(e.target.value) })} />
                            <span className="text-[10px] w-6 text-right font-mono">{(obsForm as any)[`domain${idx + 1}`]}</span>
                          </div>
                        ))}
                        <textarea className="w-full text-[11px] border rounded p-2 mt-2" rows={2} placeholder="Clinical notes..." value={obsForm.notes} onChange={e => setObsForm({ ...obsForm, notes: e.target.value })} />
                        <Button size="sm" className="mt-2 text-[10px] h-7 bg-[#7C3AED] hover:bg-[#5b21b6] text-white" onClick={() => {
                          const y = youthList.find((youth: any) => youth.id === selectedYouthId);
                          if (!y) return;
                          createObs.mutate({ youthId: selectedYouthId, youthName: y.first_name + " " + y.last_name, mrn: y.mrn, observedBy: "Sarah Johnson", behaviorType: "routine_observation", frequency: "single", intensity: "mild", duration: "15 min", triggers: "", antecedents: "", intervention: obsForm.notes, effective: 1, prnGiven: 0, outcome: obsForm.notes, followUp: 0, followUpActions: "" });
                        }}>Submit Observation</Button>
                      </div>
                    )}

                    {/* Contact Form */}
                    {contactFormOpen && activity.type === "contact" && (
                      <div className="rounded-lg border p-4 mb-3" style={{ backgroundColor: "#ecfeff", borderColor: "#a5f3fc" }}>
                        <h4 className="text-[12px] font-semibold mb-3" style={{ color: "#0891B2" }}>Log Family Contact</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <select className="text-[11px] border rounded px-2 py-1" value={contactForm.type} onChange={e => setContactForm({ ...contactForm, type: e.target.value })}>
                            <option value="phone_call">Phone Call</option>
                            <option value="video_call">Video Call</option>
                            <option value="visit">In-Person Visit</option>
                            <option value="letter">Letter</option>
                          </select>
                          <input className="text-[11px] border rounded px-2 py-1" placeholder="Guardian name" value={contactForm.person} onChange={e => setContactForm({ ...contactForm, person: e.target.value })} />
                        </div>
                        <input className="w-full text-[11px] border rounded px-2 py-1 mb-2" placeholder="Relationship (e.g., Mother, Father)" value={contactForm.relationship} onChange={e => setContactForm({ ...contactForm, relationship: e.target.value })} />
                        <textarea className="w-full text-[11px] border rounded p-2 mb-2" rows={2} placeholder="Topics discussed..." value={contactForm.topics} onChange={e => setContactForm({ ...contactForm, topics: e.target.value })} />
                        <textarea className="w-full text-[11px] border rounded p-2 mb-2" rows={2} placeholder="Concerns raised..." value={contactForm.concerns} onChange={e => setContactForm({ ...contactForm, concerns: e.target.value })} />
                        <Button size="sm" className="text-[10px] h-7 bg-[#0891B2] hover:bg-[#0e7490] text-white" onClick={() => createContact.mutate({ youthId: "", youthName: "", mrn: "", contactType: contactForm.type, contactDirection: "outgoing", contactPerson: contactForm.person, relationship: contactForm.relationship, phoneNumber: "", topicsDiscussed: contactForm.topics, youthParticipation: "", concernsRaised: contactForm.concerns, actionItems: "", followUp: 0, followUpDate: "", outcome: "" })}>Log Contact</Button>
                      </div>
                    )}

                    {/* Handoff Form */}
                    {handoffFormOpen && activity.type === "handoff" && (
                      <div className="rounded-lg border p-4 mb-3" style={{ backgroundColor: "#f0fdfa", borderColor: "#99f6e4" }}>
                        <h4 className="text-[12px] font-semibold mb-3" style={{ color: "#245C5A" }}>Shift Handoff Note — To: David Park (Evening Lead)</h4>
                        <textarea className="w-full text-[11px] border rounded p-2 mb-2" rows={6} placeholder={`Day shift summary for 7/3/26:\n\nMarcus Johnson — AM meds taken. Refused multivitamin, re-offered at lunch, accepted. Elopement attempt 9:15am, de-escalated. Observation logged.\n\nJada Thompson — Peer altercation at lunch (verbal). De-escalated. Accepted quiet time. PRN Hydroxyzine given 10:45am, effective. Behavior plan review pending.\n\nSierra Harris — SAFETY WATCH ACTIVE. Self-injury incident 2:30pm. PRN given, calmed. Guardian notified. Clinician session scheduled 7/4.\n\nNia Robinson — New admission. Still isolating but accepts meals. Peer buddy assigned.\n\nOutstanding: Family meeting 7/4 (Sierra), discharge planning 7/10 (Destiny).`} value={handoffNote} onChange={e => setHandoffNote(e.target.value)} />
                        <Button size="sm" className="text-[10px] h-7 bg-[#245C5A] hover:bg-[#1a3a38] text-white" onClick={() => {
                          createContact.mutate({ youthId: "", youthName: "", mrn: "", contactType: "handoff_note", contactDirection: "internal", contactPerson: "David Park", relationship: "Evening Lead", phoneNumber: "", topicsDiscussed: handoffNote || "See handoff note", youthParticipation: "", concernsRaised: "", actionItems: "", followUp: 1, followUpDate: "", outcome: "" });
                          setHandoffFormOpen(false);
                        }}>Submit Handoff Note</Button>
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-1.5">
                      {activity.items?.map(item => {
                        const medStatus = getMedStatus(item.medId);
                        const isMedItem = !!item.medId;
                        const medGiven = medStatus === "administered";
                        const medRefused = medStatus === "refused";
                        const medHeld = medStatus === "held";

                        return (
                          <div key={item.id} className="flex items-start gap-2 py-1.5 px-2 rounded" style={{ backgroundColor: item.status === "completed" ? "#f0fdf4" : "transparent" }}>
                            <div
                              className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer"
                              style={{ borderColor: item.status === "completed" ? "#059669" : "#d1d5db", backgroundColor: item.status === "completed" ? "#059669" : "transparent" }}
                              onClick={() => toggleItem(activity.id, item.id)}
                            >
                              {item.status === "completed" && <CheckCircle2 size={10} style={{ color: "#fff" }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-[11px] ${item.status === "completed" ? "line-through opacity-50" : ""}`} style={{ color: "var(--topbar-title)" }}>{item.label}</span>
                              {item.youthName && <span className="text-[9px] ml-2" style={{ color: "var(--topbar-subtitle)" }}>({item.youthName})</span>}
                            </div>

                            {/* Med action buttons */}
                            {isMedItem && item.status !== "completed" && (
                              <div className="flex gap-1 flex-shrink-0">
                                {medGiven ? (
                                  <Badge className="text-[8px] h-5 bg-green-100 text-green-700">Given</Badge>
                                ) : medRefused ? (
                                  <Badge className="text-[8px] h-5 bg-orange-100 text-orange-700">Refused</Badge>
                                ) : medHeld ? (
                                  <Badge className="text-[8px] h-5 bg-gray-100 text-gray-700">Held</Badge>
                                ) : (
                                  <>
                                    <button className="text-[9px] px-2 py-0.5 rounded border-none font-medium cursor-pointer" style={{ backgroundColor: "#dcfce7", color: "#166534" }} onClick={() => { adminMed.mutate({ medicationId: item.medId }); toggleItem(activity.id, item.id); }}>Give</button>
                                    <button className="text-[9px] px-2 py-0.5 rounded border-none font-medium cursor-pointer" style={{ backgroundColor: "#ffedd5", color: "#9a3412" }} onClick={() => { refuseMed.mutate({ medicationId: item.medId, reason: "Youth refused" }); }}>Refuse</button>
                                    <button className="text-[9px] px-2 py-0.5 rounded border-none font-medium cursor-pointer" style={{ backgroundColor: "#f3f4f6", color: "#374151" }} onClick={() => { holdMedMut.mutate({ medicationId: item.medId, reason: "Clinical hold" }); }}>Hold</button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ SHIFT SUMMARY FOOTER ═══ */}
        <div className="rounded-lg border p-4 mt-6" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Shift Summary — Proof of Work</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Pill size={18} className="mx-auto mb-1" style={{ color: "#2563EB" }} />
              <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{medSummary?.administered || 0}</div>
              <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Meds Administered</div>
            </div>
            <div className="text-center">
              <ClipboardList size={18} className="mx-auto mb-1" style={{ color: "#7C3AED" }} />
              <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{behavioralObs.length}</div>
              <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Observations Logged</div>
            </div>
            <div className="text-center">
              <Phone size={18} className="mx-auto mb-1" style={{ color: "#0891B2" }} />
              <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{familyContacts.length}</div>
              <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Family Contacts</div>
            </div>
            <div className="text-center">
              <CheckCircle2 size={18} className="mx-auto mb-1" style={{ color: "#059669" }} />
              <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{completedItems}</div>
              <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Tasks Completed</div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default MyShiftPage;
