/**
 * D014-01: "Ask AMOS" Help Panel
 * Accessible from every page via floating button.
 * Provides role-based guidance: FAQ, quick tips, keyboard shortcuts, contact info.
 * Uses shadcn/ui Sheet component for slide-in panel.
 * Collapsible sections via Accordion.
 */
import { useState, useCallback } from "react";
import {
  HelpCircle,
  X,
  MessageCircleQuestion,
  Lightbulb,
  Keyboard,
  Phone,
  ArrowUpRight,
  Send,
  ChevronDown,
  Search,
  User,
  Shield,
  Stethoscope,
  Home,
  Building2,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ... from "@/hooks/use-auth"

// ─── Types ─────────────────────────────────────────────────────
interface HelpTopic {
  id: string;
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

interface FaqEntry {
  q: string;
  a: string;
}

interface ShortcutEntry {
  keys: string;
  action: string;
}

// ─── Role Categories ───────────────────────────────────────────
type RoleCategory = "clinical" | "gro" | "hr" | "qa" | "executive" | "general";

function getRoleCategory(role: string): RoleCategory {
  if (role.startsWith("clinical-") || role === "therapist" || role === "nurse" || role === "qmhp-cs" || role === "case-manager" || role === "intake-coordinator" || role === "medication-aide" || role === "behavioral-support" || role === "crisis-intervention-specialist" || role === "bhc-director" || role === "treatment-director") return "clinical";
  if (role.startsWith("rcs-") || role.startsWith("gro-") || role === "program-director" || role === "shift-supervisor" || role === "youth-care-worker" || role === "recreation-coordinator" || role === "family-liaison") return "gro";
  if (role.startsWith("hr-") || role === "training-coordinator") return "hr";
  if (role === "chart-auditor" || role === "qa-coordinator" || role === "compliance-officer" || role === "revenue-cycle-manager" || role === "billing-specialist") return "qa";
  if (role === "super-admin" || role === "managing-director" || role === "administrator") return "executive";
  return "general";
}

// ─── Role-Based FAQ Content ────────────────────────────────────
const FAQ_BY_ROLE: Record<RoleCategory, FaqEntry[]> = {
  clinical: [
    { q: "How do I create a new treatment plan?", a: "Navigate to Clinical > Treatment Plans and click 'New Plan'. Select the youth, choose a template, and fill in goals, interventions, and target dates. All clinical outputs require clinician review before finalization." },
    { q: "Where do I document a session note?", a: "Go to Clinical > Sessions and click 'New Session'. Select the client, session type, and enter your notes. Session notes auto-save every 30 seconds." },
    { q: "How do I submit a CANS assessment?", a: "Navigate to Clinical > CANS Assessments. Select the youth and complete all domain sections. The system will calculate the overall score upon submission." },
    { q: "What is the MAR verification process?", a: "Use Mobile MAR for med passes. Scan the youth's wristband, verify the medication against the eMAR, and document administration or refusal with a reason code." },
    { q: "How do I flag a clinical alert?", a: "Use the red alert button in any clinical module. The alert is routed to the Clinical Director and documented in the Sentinel log." },
  ],
  gro: [
    { q: "How do I complete a shift log?", a: "Go to GRO > Shift Logs. Your current shift auto-loads. Add entries with timestamps, categorize by type (observation, incident, care, etc.), and sign at shift end." },
    { q: "What is the safety round checklist?", a: "Navigate to GRO > Safety Rounds. Complete all 8 inspection points per area. Any deficiencies auto-generate a work order to Facilities." },
    { q: "How do I document a behavioral incident?", a: "Go to GRO > Incidents. Click 'New Incident', select severity level, describe the event using the D-CS format, and notify your supervisor." },
    { q: "How do I complete a handoff?", a: "At shift end, go to GRO > Shift Handoffs. The system aggregates your shift entries. Add pending items, warnings, and sign off. The incoming shift lead receives a notification." },
    { q: "Where do I log youth care activities?", a: "Use GRO > Care Logs for per-resident daily living, behavioral, medical, and emotional support entries." },
  ],
  hr: [
    { q: "How do I process a new hire?", a: "Navigate to HR Command Center > Recruitment. Move the candidate through the pipeline: Screening > Offer > Orientation > Clearance > Active." },
    { q: "Where do I track credentials?", a: "Use HR > Credential Tracker. Upload documents, set expiration alerts, and verify compliance status." },
    { q: "How do I initiate a separation?", a: "Go to HR > Separations. Select the employee, choose separation type, and the system generates the checklist and timeline." },
    { q: "How do I run a personnel file audit?", a: "Navigate to HR > Compliance & Audits. Select the employee and audit type. The system checks for missing documents and compliance gaps." },
    { q: "Where do I assign training modules?", a: "Use HR > Training Assign. Select employees, choose training modules, set due dates, and track completion." },
  ],
  qa: [
    { q: "How do I create a CAP entry?", a: "Navigate to QA > CAP Tracker. Click 'New CAP', link to the audit finding, define corrective action, assign owner, and set due date." },
    { q: "Where do I review deficiency trends?", a: "Use QA > Deficiency Tracking. Filter by department, date range, and severity. Trend charts auto-generate." },
    { q: "How do I prepare for an HHSC audit?", a: "Go to QA > Audit Binder. Select HHSC audit type. The system compiles required evidence and flags gaps." },
    { q: "What is the evidence matrix?", a: "QA > Evidence Matrix maps each regulatory requirement to supporting documentation. Upload evidence, link to policies, and track coverage." },
    { q: "How do I route a compliance memo?", a: "Create the memo in QA > Memos. All compliance outputs route to the QA Officer for review before distribution." },
  ],
  executive: [
    { q: "How do I view the MGMA scorecard?", a: "Navigate to Executive > MGMA Scorecard. KPIs auto-refresh from Revenue and Clinical modules." },
    { q: "Where do I track strategic projects?", a: "Use Executive > Strategic Projects. Define milestones, assign owners, and track progress with automated status updates." },
    { q: "How do I review campus census?", a: "The Campus Census dashboard shows real-time bed utilization, admissions, discharges, and length-of-stay trends." },
    { q: "Where are compliance alerts?", a: "Executive dashboards surface priority alerts from QA, Revenue, and Clinical modules requiring executive attention." },
    { q: "How do I manage user access?", a: "Go to Admin > Settings for user management, role assignment, and permission configuration." },
  ],
  general: [
    { q: "How do I search across all modules?", a: "Use the NIL Graph (Admin > NIL Graph) for semantic search across all AMOS modules, documents, and knowledge base." },
    { q: "Where do I find SOPs?", a: "Navigate to Knowledge & SOP for the full standard operating procedures library, searchable by department." },
    { q: "How do I change my role?", a: "Use the role switcher in the left sidebar. Your available roles depend on your assigned permissions." },
    { q: "How do I report a system issue?", a: "Click the escalation button below to request human support, or contact IT at support@adolbi.com." },
    { q: "Where do I find keyboard shortcuts?", a: "Open this help panel and navigate to the Keyboard Shortcuts section for a full list." },
  ],
};

// ─── Quick Tips by Role ────────────────────────────────────────
const TIPS_BY_ROLE: Record<RoleCategory, string[]> = {
  clinical: [
    "Always verify youth identity before documenting — scan wristband when available.",
    "Treatment plan reviews are due every 30 days — the system will remind you 3 days before.",
    "Session notes must be completed within 24 hours of the session.",
    "Use the Crisis flag for any mention of self-harm, elopement risk, or aggression.",
    "All clinical outputs require clinician review — nothing auto-finalizes.",
  ],
  gro: [
    "Complete safety rounds at the start of every shift — don't skip areas.",
    "Behavioral incidents must be documented within 15 minutes of resolution.",
    "Handoff notes should include: mood, medications given, pending items, and warnings.",
    "Youth care logs are reviewed daily by the Program Director — be specific.",
    "Use the Escalation button in the help panel for after-hours supervisor contact.",
  ],
  hr: [
    "Credential expiration alerts trigger 30, 14, and 7 days before expiry.",
    "New hire clearance requires all 7 file sections to be complete.",
    "Performance reviews follow a 90-day cycle — supervisors get notified automatically.",
    "Background check results must be verified before any clearance step.",
    " PHI access is logged automatically — ensure you have authorization before viewing personnel files.",
  ],
  qa: [
    "All compliance outputs route to the QA Officer for review before distribution.",
    "Chart audits follow the 10-point scoring rubric — refer to the toolkit for details.",
    "CAP closure requires evidence upload — verbal confirmation is not sufficient.",
    "HHSC export data is refreshed nightly at 2 AM.",
    "Use the Evidence Matrix to verify regulatory coverage before any external audit.",
  ],
  executive: [
    "Dashboard KPIs refresh every 5 minutes for real-time operational visibility.",
    "Critical alerts (P0) trigger notifications to all executive roles.",
    "The MGMA scorecard compares your metrics against national benchmarks.",
    "Strategic project milestones trigger auto-updates to stakeholders.",
    "Persona system logs are available under Analytics > Agent Activity.",
  ],
  general: [
    "Your current role is shown in the sidebar — switch roles using the dropdown.",
    "The NIL Graph can answer natural language questions across all modules.",
    "Use Ctrl+K (Cmd+K on Mac) to open the quick navigation menu.",
    "All PHI access is logged — report unauthorized access immediately.",
    "Training resources are in the Knowledge & SOP section.",
  ],
};

// ─── Keyboard Shortcuts ────────────────────────────────────────
const SHORTCUTS: ShortcutEntry[] = [
  { keys: "Ctrl + K", action: "Quick navigation menu" },
  { keys: "Ctrl + /", action: "Open this help panel" },
  { keys: "Ctrl + S", action: "Save current form" },
  { keys: "Ctrl + P", action: "Print current page" },
  { keys: "Esc", action: "Close modal / panel" },
  { keys: "/", action: "Focus search field" },
  { keys: "?", action: "Show keyboard shortcut legend" },
  { keys: "Alt + 1", action: "Go to Dashboard" },
  { keys: "Alt + 2", action: "Go to Workflows" },
  { keys: "Alt + N", action: "Create new item" },
];

// ─── Contact Info ──────────────────────────────────────────────
const CONTACTS = [
  { role: "IT Support", email: "support@adolbi.com", phone: "(512) 555-0100", hours: "Mon-Fri 8AM-6PM" },
  { role: "Clinical Director", email: "clinical@adolbi.com", phone: "(512) 555-0101", hours: "24/7 On-call" },
  { role: "GRO Administrator", email: "gro-admin@adolbi.com", phone: "(512) 555-0102", hours: "Mon-Sun 7AM-10PM" },
  { role: "HR Director", email: "hr@adolbi.com", phone: "(512) 555-0103", hours: "Mon-Fri 8AM-5PM" },
  { role: "QA Officer", email: "qa@adolbi.com", phone: "(512) 555-0104", hours: "Mon-Fri 8AM-5PM" },
  { role: "Emergency", email: "", phone: "911", hours: "Always" },
];

// ─── Priority Badge Helper ─────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P0: "#DC2626",
    P1: "#EA580C",
    P2: "#D97706",
    P3: "#059669",
  };
  const color = colors[priority] ?? "#6B7280";
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: color + "15", color }}>
      {priority}
    </span>
  );
}

// ─── Accordion Sub-Component ───────────────────────────────────
function CollapsibleSection({
  icon: Icon,
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg mb-2" style={{ borderColor: "var(--card-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg transition-colors"
        style={{ backgroundColor: open ? "rgba(36,92,90,0.05)" : "transparent" }}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: "#245C5A" }} />
          <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{title}</span>
          {badge}
        </div>
        <ChevronDown
          size={14}
          style={{ color: "var(--topbar-subtitle)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid var(--card-border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function AskAmosPanel() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [escalationForm, setEscalationForm] = useState({ subject: "", message: "" });
  const [escalationSent, setEscalationSent] = useState(false);
  const { user, currentRole } = useAuth();

  const roleCategory = getRoleCategory(currentRole);
  const roleDef = user ? { label: user.name, department: user.department ?? "General" } : { label: "User", department: "General" };

  // Get role-specific content
  const faqs = FAQ_BY_ROLE[roleCategory] ?? FAQ_BY_ROLE.general;
  const tips = TIPS_BY_ROLE[roleCategory] ?? TIPS_BY_ROLE.general;

  // Filter FAQ by search
  const filteredFaqs = searchQuery
    ? faqs.filter((f) => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : faqs;

  const handleEscalationSubmit = useCallback(() => {
    setEscalationSent(true);
    setTimeout(() => {
      setEscalationOpen(false);
      setEscalationSent(false);
      setEscalationForm({ subject: "", message: "" });
    }, 2500);
  }, []);

  return (
    <>
      {/* ─── Floating Help Button ─── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[45] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          backgroundColor: "#245C5A",
          color: "white",
          cursor: "pointer",
        }}
        title="Ask AMOS (Ctrl + /)"
        aria-label="Open help panel"
      >
        <HelpCircle size={22} />
      </button>

      {/* ─── Help Panel Sheet ─── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A15" }}>
                <MessageCircleQuestion size={18} style={{ color: "#245C5A" }} />
              </div>
              <div>
                <SheetTitle className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>
                  Ask AMOS
                </SheetTitle>
                <SheetDescription className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  Help for {roleDef.label} — {roleDef.department}
                </SheetDescription>
              </div>
            </div>
            {/* Search */}
            <div className="relative mt-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
              <Input
                placeholder="Search help topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-[12px] h-8"
              />
            </div>
          </SheetHeader>

          {/* Body — Scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* FAQ Section */}
            <CollapsibleSection
              icon={MessageCircleQuestion}
              title="Frequently Asked Questions"
              badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#245C5A12", color: "#245C5A" }}>{filteredFaqs.length}</span>}
              defaultOpen={true}
            >
              <div className="space-y-2">
                {filteredFaqs.map((faq, i) => (
                  <div key={i} className="rounded-md p-2.5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>{faq.q}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--topbar-subtitle)" }}>{faq.a}</p>
                  </div>
                ))}
                {filteredFaqs.length === 0 && (
                  <p className="text-[11px] italic py-2" style={{ color: "var(--topbar-subtitle)" }}>No matching FAQ found.</p>
                )}
              </div>
            </CollapsibleSection>

            {/* Quick Tips */}
            <CollapsibleSection icon={Lightbulb} title="Quick Tips" badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#D9770612", color: "#D97706" }}>{tips.length}</span>}>
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--topbar-subtitle)" }}>
                    <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>

            {/* Keyboard Shortcuts */}
            <CollapsibleSection icon={Keyboard} title="Keyboard Shortcuts" badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#991B1B12", color: "#991B1B" }}>{SHORTCUTS.length}</span>}>
              <div className="grid grid-cols-1 gap-1.5">
                {SHORTCUTS.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{sc.action}</span>
                    <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium" style={{ backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>
                      {sc.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Contact Info */}
            <CollapsibleSection icon={Phone} title="Contact Directory" badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#1E40AF12", color: "#1E40AF" }}>{CONTACTS.length}</span>}>
              <div className="space-y-2">
                {CONTACTS.map((contact, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <div className="mt-0.5">
                      {contact.role === "Emergency" ? (
                        <AlertTriangle size={13} style={{ color: "#DC2626" }} />
                      ) : (
                        <User size={13} style={{ color: "#245C5A" }} />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: "var(--topbar-title)" }}>{contact.role}</p>
                      {contact.email && <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{contact.email}</p>}
                      <p className="text-[10px] font-medium" style={{ color: "#245C5A" }}>{contact.phone}</p>
                      <p className="text-[9px]" style={{ color: "#9CA3AF" }}>{contact.hours}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          {/* Footer — Escalation */}
          <div className="p-4 border-t" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            {!escalationOpen ? (
              <Button
                onClick={() => setEscalationOpen(true)}
                className="w-full flex items-center justify-center gap-2 text-[12px]"
                style={{ backgroundColor: "#245C5A" }}
              >
                <ArrowUpRight size={14} />
                Request Human Support
              </Button>
            ) : escalationSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#DCFCE7" }}>
                <CheckCircle2 size={16} style={{ color: "#059669" }} />
                <span className="text-[12px] font-medium" style={{ color: "#059669" }}>Support request submitted! We will respond within 15 minutes.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Request Human Support</p>
                <Input
                  placeholder="Subject"
                  value={escalationForm.subject}
                  onChange={(e) => setEscalationForm({ ...escalationForm, subject: e.target.value })}
                  className="text-[11px] h-8"
                />
                <textarea
                  placeholder="Describe your issue..."
                  value={escalationForm.message}
                  onChange={(e) => setEscalationForm({ ...escalationForm, message: e.target.value })}
                  className="w-full text-[11px] rounded-md border p-2 resize-none"
                  style={{ borderColor: "var(--card-border)", minHeight: 60 }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleEscalationSubmit}
                    disabled={!escalationForm.subject || !escalationForm.message}
                    className="flex-1 text-[11px] h-8"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    <Send size={12} className="mr-1" />
                    Submit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEscalationOpen(false)}
                    className="text-[11px] h-8"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default AskAmosPanel;
