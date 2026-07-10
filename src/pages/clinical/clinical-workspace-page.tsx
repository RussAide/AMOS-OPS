/**
 * ClinicalWorkspacePage.tsx
 *
 * BHC Frontline Clinical Workspace — Action-first UX for speed.
 * Tasks: D007-01, D007-02, D007-03, D007-04
 *
 * Features:
 *  - D007-01: 5 Quick Actions (Admit, Start Session, SOAP Note, Outcome Measure, View Plan)
 *  - D007-02: Patient Directory (search, filters, alerts, quick stats)
 *  - D007-03: SOAP Note documentation form with 4 tabs + billing codes + auto-save
 *  - D007-04: Outcome Measure Runner (CANS, PHQ-A, PCL-5) with scoring & severity flags
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AgentPersonaIndicator } from "@/components/agents/agent-persona-indicator";
import { PageLayout } from "@/components/shell/page-layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Play,
  FileText,
  ClipboardCheck,
  BookOpen,
  Search,
  X,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  HeartPulse,
  ChevronRight,
  Save,
  CheckCircle2,
  BarChart3,
  Calendar,
  Stethoscope,
  XCircle,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  BookOpenCheck,
  ArrowRightLeft,
  Package2,
  ShieldCheck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type QuickActionKey =
  | "admit"
  | "session"
  | "soap"
  | "outcome"
  | "treatment-plan";

type OutcomeMeasureType = "CANS" | "PHQ-A" | "PCL-5";

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  billingCode: string;
}

interface OutcomeQuestion {
  id: string;
  text: string;
  domain: string;
  options: { label: string; value: number }[];
}

interface OutcomeMeasureDef {
  type: OutcomeMeasureType;
  name: string;
  description: string;
  questions: OutcomeQuestion[];
  severityLevels: { label: string; min: number; max: number; color: string }[];
}

// ─── Outcome Measure Definitions ─────────────────────────────────────────────

const OUTCOME_MEASURES: OutcomeMeasureDef[] = [
  {
    type: "PHQ-A",
    name: "PHQ-A (Depression)",
    description: "Patient Health Questionnaire for Adolescents — 13 items assessing depression severity.",
    questions: [
      { id: "phqa-1", text: "Little interest or pleasure in doing things", domain: "Mood", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-2", text: "Feeling down, depressed, or hopeless", domain: "Mood", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-3", text: "Trouble falling or staying asleep, or sleeping too much", domain: "Somatic", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-4", text: "Feeling tired or having little energy", domain: "Somatic", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-5", text: "Poor appetite or overeating", domain: "Somatic", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-6", text: "Feeling bad about yourself or that you are a failure", domain: "Cognitive", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-7", text: "Trouble concentrating on things", domain: "Cognitive", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-8", text: "Moving or speaking slowly OR being fidgety/restless", domain: "Somatic", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
      { id: "phqa-9", text: "Thoughts that you would be better off dead or hurting yourself", domain: "Suicide", options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }] },
    ],
    severityLevels: [
      { label: "Minimal", min: 0, max: 4, color: "#059669" },
      { label: "Mild", min: 5, max: 9, color: "#65A30D" },
      { label: "Moderate", min: 10, max: 14, color: "#D97706" },
      { label: "Moderately Severe", min: 15, max: 19, color: "#EA580C" },
      { label: "Severe", min: 20, max: 27, color: "#DC2626" },
    ],
  },
  {
    type: "PCL-5",
    name: "PCL-5 (PTSD)",
    description: "PTSD Checklist for DSM-5 — 20 items assessing PTSD symptom severity.",
    questions: [
      { id: "pcl-1", text: "Repeated, disturbing, and unwanted memories of the stressful experience", domain: "Intrusion", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-2", text: "Repeated, disturbing dreams of the stressful experience", domain: "Intrusion", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-3", text: "Suddenly feeling or acting as if the stressful experience were happening again", domain: "Intrusion", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-4", text: "Feeling very upset when something reminded you of the stressful experience", domain: "Intrusion", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-5", text: "Having strong physical reactions when reminded of the stressful experience", domain: "Intrusion", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-6", text: "Avoiding memories, thoughts, or feelings related to the stressful experience", domain: "Avoidance", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-7", text: "Avoiding external reminders of the stressful experience", domain: "Avoidance", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-8", text: "Trouble remembering important parts of the stressful experience", domain: "Cognition", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-9", text: "Having strong negative beliefs about yourself, other people, or the world", domain: "Cognition", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
      { id: "pcl-10", text: "Blaming yourself or someone else for the stressful experience", domain: "Cognition", options: [{ label: "Not at all", value: 0 }, { label: "A little bit", value: 1 }, { label: "Moderately", value: 2 }, { label: "Quite a bit", value: 3 }, { label: "Extremely", value: 4 }] },
    ],
    severityLevels: [
      { label: "Minimal", min: 0, max: 10, color: "#059669" },
      { label: "Mild", min: 11, max: 20, color: "#65A30D" },
      { label: "Moderate", min: 21, max: 33, color: "#D97706" },
      { label: "Severe", min: 34, max: 40, color: "#DC2626" },
    ],
  },
  {
    type: "CANS",
    name: "CANS (Child & Adolescent Needs)",
    description: "CANS Assessment — 10 key items assessing youth needs and strengths.",
    questions: [
      { id: "cans-1", text: "Psychosis — Thoughts or behaviors indicating disturbance in thinking", domain: "Risk", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-2", text: "Impulse/Hyperactivity — Difficulty controlling impulses or hyperactivity", domain: "Behavior", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-3", text: "Depression — Sadness, hopelessness, loss of interest", domain: "Mood", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-4", text: "Anxiety — Excessive worry, fear, or avoidance behaviors", domain: "Mood", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-5", text: "Substance Use — Use of alcohol or drugs", domain: "Risk", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-6", text: "Attachment — Difficulty forming emotional bonds or separation anxiety", domain: "Relationships", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-7", text: "Behavioral Problems — Aggression, defiance, rule-breaking", domain: "Behavior", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-8", text: "Adjustment to Trauma — Difficulty coping with past traumatic experiences", domain: "Trauma", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-9", text: "Anger Control — Difficulty managing anger or frustration", domain: "Behavior", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
      { id: "cans-10", text: "Suicide Risk — Thoughts or behaviors related to self-harm or suicide", domain: "Risk", options: [{ label: "No evidence", value: 0 }, { label: "History/watch", value: 1 }, { label: "Mild/active", value: 2 }, { label: "Significant", value: 3 }] },
    ],
    severityLevels: [
      { label: "Low Needs", min: 0, max: 7, color: "#059669" },
      { label: "Moderate Needs", min: 8, max: 15, color: "#D97706" },
      { label: "High Needs", min: 16, max: 22, color: "#EA580C" },
      { label: "Intensive Needs", min: 23, max: 30, color: "#DC2626" },
    ],
  },
];

// ─── Billing Codes ───────────────────────────────────────────────────────────

const BILLING_CODES = [
  { code: "H0004", description: "Individual Therapy — 60 min", rate: "$125" },
  { code: "H0004-HA", description: "Individual Therapy — 45 min", rate: "$95" },
  { code: "H0031", description: "Mental Health Assessment", rate: "$150" },
  { code: "H0035", description: "Residential Treatment — per diem", rate: "$285" },
  { code: "H2017", description: "Psychoeducational Service", rate: "$75" },
  { code: "H2019", description: "Therapeutic Behavioral Service", rate: "$110" },
  { code: "H2036", description: "Group Therapy — per session", rate: "$45" },
  { code: "T1023", description: "Case Management — per unit", rate: "$65" },
];

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  intake: "#2563EB",
  active: "#059669",
  hold: "#D97706",
  discharged: "#6B7280",
  transferred: "#7C3AED",
};

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  active: "Active",
  hold: "On Hold",
  discharged: "Discharged",
  transferred: "Transferred",
};

// ─── Quick Action Config ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    key: "admit" as QuickActionKey,
    label: "Admit New Patient",
    targetTime: "<2min",
    color: "#059669",
    bgClass: "bg-green-600 hover:bg-green-700",
    icon: UserPlus,
    description: "Start new patient intake process",
  },
  {
    key: "session" as QuickActionKey,
    label: "Start Session",
    targetTime: "<1min",
    color: "#2563EB",
    bgClass: "bg-blue-600 hover:bg-blue-700",
    icon: Play,
    description: "Begin a clinical session",
  },
  {
    key: "soap" as QuickActionKey,
    label: "Complete Service Note",
    targetTime: "<5min",
    color: "#D97706",
    bgClass: "bg-amber-600 hover:bg-amber-700",
    icon: FileText,
    description: "Document a clinical session (SOAP)",
  },
  {
    key: "outcome" as QuickActionKey,
    label: "Run Outcome Measure",
    targetTime: "<3min",
    color: "#7C3AED",
    bgClass: "bg-purple-600 hover:bg-purple-700",
    icon: ClipboardCheck,
    description: "Administer CANS, PHQ-A, or PCL-5",
  },
  {
    key: "treatment-plan" as QuickActionKey,
    label: "View Treatment Plan",
    targetTime: "<30sec",
    color: "#0891B2",
    bgClass: "bg-cyan-600 hover:bg-cyan-700",
    icon: BookOpen,
    description: "Quick access to active treatment plans",
  },
];

// ─── Helper Components ───────────────────────────────────────────────────────

function SeverityBadge({ level, color }: { level: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: color + "18", color, border: `1px solid ${color}30` }}
    >
      {color === "#059669" && <CheckCircle2 size={12} />}
      {color === "#D97706" && <AlertTriangle size={12} />}
      {(color === "#DC2626" || color === "#EA580C") && <ShieldAlert size={12} />}
      {level}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-3 flex items-center gap-3"
      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: alert ? "#FEF2F2" : color + "12" }}
      >
        <Icon size={18} style={{ color: alert ? "#DC2626" : color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium truncate" style={{ color: "var(--topbar-subtitle)" }}>
          {label}
        </p>
        <p className="text-[20px] font-bold leading-tight" style={{ color: alert ? "#DC2626" : "var(--topbar-title)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  D007-03: SOAP NOTE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function SoapNoteModal({
  open,
  onClose,
  preselectedPatientId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedPatientId?: string;
}) {
  const navigate = useNavigate();
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const [activeTab, setActiveTab] = useState("subjective");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [soapNote, setSoapNote] = useState<SoapNote>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    billingCode: "",
  });
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId ?? "");

  // Auto-save draft every 30 seconds
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      autoSaveRef.current = setInterval(() => {
        if (soapNote.subjective || soapNote.objective || soapNote.assessment || soapNote.plan) {
          setSaving(true);
          setTimeout(() => {
            setLastSaved(new Date());
            setSaving(false);
          }, 500);
        }
      }, 30000);
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [open, soapNote]);

  const handleSubmit = () => {
    // In production: call trpc.m5.createSessionNote.useMutation()
    onClose();
  };

  const patients = patientsData?.patients ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <FileText size={18} style={{ color: "#D97706" }} />
            Complete Service Note — SOAP
          </DialogTitle>
          <DialogDescription>
            Document the clinical session using the SOAP format. All fields require clinician review.
          </DialogDescription>
        </DialogHeader>

        {/* Patient Selector */}
        <div className="mb-2">
          <Label className="text-[12px] mb-1 block">Patient</Label>
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a patient..." />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName} — {p.mrn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Billing Code */}
        <div className="mb-2">
          <Label className="text-[12px] mb-1 block">Billing Code</Label>
          <Select value={soapNote.billingCode} onValueChange={(v) => setSoapNote((s) => ({ ...s, billingCode: v }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select billing code..." />
            </SelectTrigger>
            <SelectContent>
              {BILLING_CODES.map((bc) => (
                <SelectItem key={bc.code} value={bc.code}>
                  {bc.code} — {bc.description} ({bc.rate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {saving && <Save size={12} className="animate-pulse text-blue-500" />}
            {lastSaved && !saving && (
              <span className="text-[11px] text-green-600 flex items-center gap-1">
                <CheckCircle2 size={11} /> Auto-saved at {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* SOAP Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="subjective" className="text-[12px]">
              Subjective
            </TabsTrigger>
            <TabsTrigger value="objective" className="text-[12px]">
              Objective
            </TabsTrigger>
            <TabsTrigger value="assessment" className="text-[12px]">
              Assessment
            </TabsTrigger>
            <TabsTrigger value="plan" className="text-[12px]">
              Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subjective" className="mt-3 space-y-2">
            <Label className="text-[12px]">
              Subjective — Patient&apos;s reported symptoms, concerns, and perspective
            </Label>
            <Textarea
              placeholder="Patient reports... Chief complaint... History of present illness..."
              className="min-h-[180px] text-[13px]"
              value={soapNote.subjective}
              onChange={(e) => setSoapNote((s) => ({ ...s, subjective: e.target.value }))}
            />
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Tip: Include chief complaint, HPI, and patient&apos;s own words in quotes.
            </div>
          </TabsContent>

          <TabsContent value="objective" className="mt-3 space-y-2">
            <Label className="text-[12px]">
              Objective — Observable data, mental status exam, vital signs
            </Label>
            <Textarea
              placeholder="Mental Status Exam... Appearance... Behavior... Mood/Affect... Speech..."
              className="min-h-[180px] text-[13px]"
              value={soapNote.objective}
              onChange={(e) => setSoapNote((s) => ({ ...s, objective: e.target.value }))}
            />
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Tip: Document MSE findings, observed behaviors, and objective measurements.
            </div>
          </TabsContent>

          <TabsContent value="assessment" className="mt-3 space-y-2">
            <Label className="text-[12px]">
              Assessment — Clinical formulation, diagnoses, risk assessment
            </Label>
            <Textarea
              placeholder="Clinical impression... Differential diagnosis... Risk assessment... Progress toward goals..."
              className="min-h-[180px] text-[13px]"
              value={soapNote.assessment}
              onChange={(e) => setSoapNote((s) => ({ ...s, assessment: e.target.value }))}
            />
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Tip: Include diagnosis codes, risk level, and progress toward treatment goals.
            </div>
          </TabsContent>

          <TabsContent value="plan" className="mt-3 space-y-2">
            <Label className="text-[12px]">
              Plan — Interventions, next steps, referrals, follow-up
            </Label>
            <Textarea
              placeholder="Treatment plan modifications... Interventions used... Homework assigned... Next session goals..."
              className="min-h-[180px] text-[13px]"
              value={soapNote.plan}
              onChange={(e) => setSoapNote((s) => ({ ...s, plan: e.target.value }))}
            />
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Tip: Document interventions used, patient response, homework, and next session date.
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium border"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
            style={{ backgroundColor: "#D97706" }}
          >
            Complete & Submit Note
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  D007-04: OUTCOME MEASURE RUNNER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function OutcomeMeasureModal({
  open,
  onClose,
  preselectedPatientId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedPatientId?: string;
}) {
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const [selectedMeasure, setSelectedMeasure] = useState<OutcomeMeasureType | "">("");
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId ?? "");
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const measureDef = OUTCOME_MEASURES.find((m) => m.type === selectedMeasure);

  const totalScore = Object.values(responses).reduce((sum, v) => sum + (v || 0), 0);
  const maxPossible = measureDef?.questions.reduce((s, q) => s + Math.max(...q.options.map((o) => o.value)), 0) ?? 0;
  const answeredCount = Object.keys(responses).filter((k) => responses[k] !== undefined).length;
  const totalQuestions = measureDef?.questions.length ?? 0;

  const severityLevel =
    measureDef?.severityLevels.find((sl) => totalScore >= sl.min && totalScore <= sl.max) ?? null;

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setResponses({});
      setSelectedMeasure("");
      onClose();
    }, 2000);
  };

  const handleResponse = (questionId: string, value: number) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const reset = () => {
    setResponses({});
    setSelectedMeasure("");
    setSubmitted(false);
  };

  const patients = patientsData?.patients ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <BarChart3 size={18} style={{ color: "#7C3AED" }} />
            Run Outcome Measure
          </DialogTitle>
          <DialogDescription>
            Select a validated outcome measure, administer it, and scores are auto-calculated with severity flags.
          </DialogDescription>
        </DialogHeader>

        {/* Patient Selector */}
        <div className="mb-3">
          <Label className="text-[12px] mb-1 block">Patient</Label>
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a patient..." />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName} — {p.mrn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Measure Selector */}
        {!selectedMeasure && (
          <div className="space-y-3 mt-2">
            <Label className="text-[12px] block">Select Measure</Label>
            <div className="grid grid-cols-1 gap-3">
              {OUTCOME_MEASURES.map((m) => (
                <button
                  key={m.type}
                  onClick={() => setSelectedMeasure(m.type)}
                  className="flex items-start gap-4 p-4 rounded-lg border text-left transition-all hover:shadow-sm hover:border-purple-300"
                  style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck size={18} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                        {m.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {m.questions.length} items
                      </Badge>
                    </div>
                    <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                      {m.description}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--topbar-subtitle)" }} className="mt-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Measure Form */}
        {selectedMeasure && measureDef && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                  {measureDef.name}
                </h3>
                <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {answeredCount} of {totalQuestions} answered
                </p>
              </div>
              <button
                onClick={reset}
                className="text-[12px] flex items-center gap-1 px-3 py-1.5 rounded-md border"
                style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
              >
                <X size={12} /> Change Measure
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
                  backgroundColor: answeredCount === totalQuestions ? "#059669" : "#7C3AED",
                }}
              />
            </div>

            {/* Questions */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {measureDef.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-3 rounded-lg border"
                  style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "#7C3AED" }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                        {q.text}
                      </p>
                      <Badge variant="outline" className="text-[9px] mt-1">
                        {q.domain}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleResponse(q.id, opt.value)}
                        className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all border"
                        style={{
                          backgroundColor: responses[q.id] === opt.value ? "#7C3AED" : "transparent",
                          color: responses[q.id] === opt.value ? "#fff" : "var(--topbar-subtitle)",
                          borderColor: responses[q.id] === opt.value ? "#7C3AED" : "var(--card-border)",
                        }}
                      >
                        {opt.label} ({opt.value})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Score Summary */}
            {answeredCount > 0 && (
              <div
                className="p-4 rounded-lg border"
                style={{ borderColor: (severityLevel?.color ?? "#999") + "40", backgroundColor: (severityLevel?.color ?? "#999") + "08" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                      Current Score
                    </p>
                    <p className="text-[28px] font-bold" style={{ color: severityLevel?.color ?? "var(--topbar-title)" }}>
                      {totalScore}
                      <span className="text-[14px] font-normal" style={{ color: "var(--topbar-subtitle)" }}>
                        {" "}/ {maxPossible}
                      </span>
                    </p>
                  </div>
                  {severityLevel && (
                    <SeverityBadge level={severityLevel.label} color={severityLevel.color} />
                  )}
                </div>
                {/* Domain breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Array.from(new Set(measureDef.questions.map((q) => q.domain))).map((domain) => {
                    const domainQuestions = measureDef.questions.filter((q) => q.domain === domain);
                    const domainScore = domainQuestions.reduce((s, q) => s + (responses[q.id] || 0), 0);
                    const domainMax = domainQuestions.reduce((s, q) => s + Math.max(...q.options.map((o) => o.value)), 0);
                    return (
                      <div key={domain} className="text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>{domain}: </span>
                        <span className="font-semibold" style={{ color: "var(--topbar-title)" }}>
                          {domainScore}/{domainMax}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {submitted && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[13px] flex items-center gap-2">
                <CheckCircle2 size={16} />
                Outcome measure submitted and linked to patient record.
              </div>
            )}

            <DialogFooter className="gap-2">
              <button
                onClick={() => { reset(); onClose(); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border"
                style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={answeredCount < totalQuestions || !selectedPatientId}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#7C3AED" }}
              >
                {answeredCount < totalQuestions
                  ? `${totalQuestions - answeredCount} items remaining`
                  : "Submit & Link to Record"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  D007-01: ADMIT PATIENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function AdmitPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as string,
    phone: "",
    email: "",
    address: "",
    insuranceId: "",
    emergencyName: "",
    emergencyPhone: "",
    referralSource: "",
    assignedClinicianId: "",
  });

  const createPatient = trpc.bhc.createPatient.useMutation({
    onSuccess: () => {
      onClose();
      setForm({ firstName: "", lastName: "", dateOfBirth: "", gender: "", phone: "", email: "", address: "", insuranceId: "", emergencyName: "", emergencyPhone: "", referralSource: "", assignedClinicianId: "" });
    },
  });

  const canSubmit = form.firstName && form.lastName && form.dateOfBirth;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <UserPlus size={18} style={{ color: "#059669" }} />
            Admit New Patient
          </DialogTitle>
          <DialogDescription>Complete the intake form to register a new patient.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-[12px]">First Name *</Label>
            <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Last Name *</Label>
            <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Date of Birth *</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non_binary">Non-Binary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px]">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="text-[13px]" />
          </div>
          <div className="col-span-2">
            <Label className="text-[12px]">Address</Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Insurance ID</Label>
            <Input value={form.insuranceId} onChange={(e) => setForm((f) => ({ ...f, insuranceId: e.target.value }))} className="text-[13px]" />
          </div>
          <div>
            <Label className="text-[12px]">Referral Source</Label>
            <Input value={form.referralSource} onChange={(e) => setForm((f) => ({ ...f, referralSource: e.target.value }))} className="text-[13px]" placeholder="e.g. HISD School Counselor" />
          </div>
          <div>
            <Label className="text-[12px]">Emergency Contact</Label>
            <Input value={form.emergencyName} onChange={(e) => setForm((f) => ({ ...f, emergencyName: e.target.value }))} className="text-[13px]" placeholder="Name" />
          </div>
          <div>
            <Label className="text-[12px]">Emergency Phone</Label>
            <Input value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className="text-[13px]" />
          </div>
          <div className="col-span-2">
            <Label className="text-[12px]">Assigned Clinician ID *</Label>
            <Input value={form.assignedClinicianId} onChange={(e) => setForm((f) => ({ ...f, assignedClinicianId: e.target.value }))} className="text-[13px]" placeholder="Clinician UUID" />
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>
            Cancel
          </button>
          <button
            onClick={() => canSubmit && createPatient.mutate(form)}
            disabled={!canSubmit || createPatient.isPending}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#059669" }}
          >
            {createPatient.isPending ? "Admitting..." : "Admit Patient"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  D007-01: START SESSION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function StartSessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [sessionType, setSessionType] = useState("individual");
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    setStarted(true);
    setTimeout(() => {
      setStarted(false);
      setSelectedPatientId("");
      setSessionType("individual");
      onClose();
    }, 1500);
  };

  const patients = patientsData?.patients ?? [];
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <Play size={18} style={{ color: "#2563EB" }} />
            Start Session
          </DialogTitle>
          <DialogDescription>Select a patient and session type to begin.</DialogDescription>
        </DialogHeader>

        {!started ? (
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[12px] mb-1 block">Patient</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select patient..." /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName} — {p.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[12px] mb-1 block">Session Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {["individual", "group", "family"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSessionType(type)}
                    className="px-3 py-2 rounded-lg text-[12px] font-medium border capitalize transition-all"
                    style={{
                      backgroundColor: sessionType === type ? "#2563EB" : "var(--card-bg)",
                      color: sessionType === type ? "#fff" : "var(--topbar-subtitle)",
                      borderColor: sessionType === type ? "#2563EB" : "var(--card-border)",
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {selectedPatient && (
              <div
                className="p-3 rounded-lg border"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
                    style={{ backgroundColor: STATUS_COLORS[selectedPatient.status] ?? "#6B7280" }}
                  >
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                      {selectedPatient.lastName}, {selectedPatient.firstName}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {selectedPatient.mrn} &bull; DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedPatientId}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#2563EB" }}
              >
                Start Session Now
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Play size={28} className="text-blue-600" />
            </div>
            <p className="text-[16px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              Session Started
            </p>
            <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
              Timer running for {selectedPatient?.firstName} {selectedPatient?.lastName}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  D007-01: VIEW TREATMENT PLAN MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function ViewTreatmentPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const navigate = useNavigate();

  const patients = patientsData?.patients ?? [];
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <BookOpen size={18} style={{ color: "#0891B2" }} />
            View Treatment Plan
          </DialogTitle>
          <DialogDescription>Quick access to a patient&apos;s active treatment plan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-[12px] mb-1 block">Patient</Label>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select patient..." /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName} — {p.mrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPatient && (
            <div
              className="p-4 rounded-lg border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
                  style={{ backgroundColor: STATUS_COLORS[selectedPatient.status] ?? "#6B7280" }}
                >
                  {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                    {selectedPatient.lastName}, {selectedPatient.firstName}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    Status:{" "}
                    <span style={{ color: STATUS_COLORS[selectedPatient.status] ?? "#6B7280" }}>
                      {STATUS_LABELS[selectedPatient.status] ?? selectedPatient.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span style={{ color: "var(--topbar-subtitle)" }}>MRN</span>
                  <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{selectedPatient.mrn}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--topbar-subtitle)" }}>DOB</span>
                  <span className="font-medium" style={{ color: "var(--topbar-title)" }}>
                    {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--topbar-subtitle)" }}>Insurance</span>
                  <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{selectedPatient.insuranceId ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--topbar-subtitle)" }}>Intake Date</span>
                  <span className="font-medium" style={{ color: "var(--topbar-title)" }}>
                    {new Date(selectedPatient.intakeDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  navigate(`/clinical/patients/${selectedPatientId}`);
                }}
                className="w-full mt-4 px-4 py-2 rounded-lg text-[13px] font-medium text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: "#0891B2" }}
              >
                <Stethoscope size={14} />
                Open Full Patient Record
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ClinicalWorkspacePage() {
  const navigate = useNavigate();

  // ─── Data Queries ──────────────────────────────────────────────────────────
  const { data: patientsData, isLoading: patientsLoading } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });
  const { data: sessionsData } = trpc.bhc.listSessions.useQuery({ status: "scheduled" });
  const { data: workloadData } = trpc.bhc.clinicianWorkload.useQuery();
  const { data: dashboardKPIs } = trpc.bhc.dashboardKPIs.useQuery();

  // ─── Local State ───────────────────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<QuickActionKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "active" | "today" | "pending-docs">("all");

  // ─── Derived Data ──────────────────────────────────────────────────────────
  const allPatients = patientsData?.patients ?? [];
  const activePatients = allPatients.filter((p) => p.status === "active");
  const censusCount = allPatients.filter((p) => p.status === "active" || p.status === "hold").length;
  const openCases = activePatients.length;

  // Mock pending notes count (in production: query from backend)
  const pendingNotes = 3;

  // Overdue assessments (mock: patients without recent sessions)
  const overdueAssessmentIds = ["p4"]; // Jada Thompson on hold

  // Auth expiry alerts (mock)
  const authExpiringIds: string[] = [];

  // Filter patients for directory
  const filteredPatients = allPatients.filter((patient) => {
    // Search filter
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      patient.firstName.toLowerCase().includes(q) ||
      patient.lastName.toLowerCase().includes(q) ||
      patient.mrn.toLowerCase().includes(q) ||
      patient.dateOfBirth.includes(q);

    // Directory filter
    let matchesFilter = true;
    if (directoryFilter === "active") matchesFilter = patient.status === "active";
    if (directoryFilter === "today") {
      matchesFilter = (sessionsData ?? []).some((s) => s.patientId === patient.id);
    }
    if (directoryFilter === "pending-docs") {
      matchesFilter = patient.status === "active"; // Simplified
    }

    return matchesSearch && matchesFilter;
  });

  // ─── Modal Renderers ───────────────────────────────────────────────────────
  const renderModal = () => {
    switch (activeModal) {
      case "admit":
        return <AdmitPatientModal open={true} onClose={() => setActiveModal(null)} />;
      case "session":
        return <StartSessionModal open={true} onClose={() => setActiveModal(null)} />;
      case "soap":
        return <SoapNoteModal open={true} onClose={() => setActiveModal(null)} />;
      case "outcome":
        return <OutcomeMeasureModal open={true} onClose={() => setActiveModal(null)} />;
      case "treatment-plan":
        return <ViewTreatmentPlanModal open={true} onClose={() => setActiveModal(null)} />;
      default:
        return null;
    }
  };

  // ─── Quick Stats ───────────────────────────────────────────────────────────
  const quickStats = [
    { label: "Census", value: censusCount, icon: Users, color: "#2563EB" },
    { label: "Open Cases", value: openCases, icon: HeartPulse, color: "#059669" },
    { label: "Sessions Today", value: dashboardKPIs?.sessionsToday ?? 0, icon: Calendar, color: "#D97706" },
    { label: "Pending Notes", value: pendingNotes, icon: FileText, color: "#7C3AED", alert: pendingNotes > 0 },
  ];

  return (
    <PageLayout hideHero>
      <div className="px-4 md:px-6 pt-4 pb-8">
        {/* ─── Agent Persona Indicator ─────────────────────────────────────── */}
        <AgentPersonaIndicator agentKey="amos-clinical" />

        {/* ─── Page Header ─────────────────────────────────────────────────── */}
        <div className="mt-4 mb-4">
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            Clinical Workspace
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Frontline BHC operations — action-first design
          </p>
        </div>

        {/* ─── D007-01: Quick Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {quickStats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              alert={stat.alert}
            />
          ))}
        </div>

        {/* ─── D007-01: 5 Quick Actions ────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--topbar-subtitle)" }}>
            Quick Actions — No Navigation Required
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal(action.key)}
                  className="relative flex flex-col items-start gap-3 p-4 rounded-xl text-white transition-shadow hover:shadow-lg text-left"
                  style={{ backgroundColor: action.color }}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon size={22} />
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                    >
                      {action.targetTime}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold leading-tight">{action.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                      {action.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ─── Module Navigation ───────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--topbar-subtitle)" }}>
            Clinical Modules
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Treatment Plans", href: "/clinical/treatment-plans", icon: BookOpenCheck, color: "#0891B2", desc: "Goals & interventions" },
              { label: "Clinical Sessions", href: "/clinical/sessions", icon: FileText, color: "#2563EB", desc: "Session notes & SOAP" },
              { label: "Outcome Measures", href: "/clinical/outcome-measures", icon: BarChart3, color: "#7C3AED", desc: "PHQ-9, GAD-7, PCL-5" },
              { label: "Insurance Plans", href: "/clinical/insurance-plans", icon: ShieldCheck, color: "#059669", desc: "Payers & coverage" },
              { label: "Referral Intake", href: "/clinical/referrals", icon: ArrowRightLeft, color: "#D97706", desc: "Cross-dept referrals" },
              { label: "CANS Assessments", href: "/clinical/cans-assessments", icon: ClipboardCheck, color: "#EA580C", desc: "Domain scoring" },
              { label: "Service Delivery", href: "/clinical/service-delivery", icon: Package, color: "#6B7280", desc: "T1017 & H2017 docs" },
              { label: "Patient List", href: "/clinical/patients", icon: Users, color: "#245C5A", desc: "Full patient registry" },
            ].map((mod) => {
              const ModIcon = mod.icon;
              return (
                <button
                  key={mod.href}
                  onClick={() => navigate(mod.href)}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all hover:shadow-md hover:border-opacity-80"
                  style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.color + "12" }}>
                    <ModIcon size={16} style={{ color: mod.color }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{mod.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{mod.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── D007-02: Patient Directory ──────────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
        >
          {/* Directory Header */}
          <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} style={{ color: "#245C5A" }} />
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                  Patient Directory
                </h2>
                <Badge variant="outline" className="text-[11px]">
                  {filteredPatients.length}
                </Badge>
              </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div
                className="flex items-center gap-2 flex-1 min-w-[200px] rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--content-bg)" }}
              >
                <Search size={15} style={{ color: "var(--topbar-subtitle)" }} />
                <input
                  type="text"
                  placeholder="Search name, MRN, or DOB..."
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--topbar-title)" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <X
                    size={13}
                    className="cursor-pointer"
                    onClick={() => setSearchQuery("")}
                    style={{ color: "var(--topbar-subtitle)" }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { key: "all", label: "All Patients" },
                  { key: "active", label: "Active" },
                  { key: "today", label: "Today" },
                  { key: "pending-docs", label: "Pending Docs" },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setDirectoryFilter(f.key)}
                    className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor: directoryFilter === f.key ? "#245C5A" : "transparent",
                      color: directoryFilter === f.key ? "#fff" : "var(--topbar-subtitle)",
                      border: `1px solid ${directoryFilter === f.key ? "#245C5A" : "var(--card-border)"}`,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Patient Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--content-bg)",
                    borderBottom: `1px solid var(--card-border)`,
                  }}
                >
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    Patient
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    MRN
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    Assigned Clinician
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    Last Session
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>
                    Alerts
                  </th>
                </tr>
              </thead>
              <tbody>
                {patientsLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                      Loading patients...
                    </td>
                  </tr>
                )}
                {!patientsLoading && filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                      No patients match your criteria
                    </td>
                  </tr>
                )}
                {filteredPatients.map((patient) => {
                  const isOverdue = overdueAssessmentIds.includes(patient.id);
                  const isAuthExpiring = authExpiringIds.includes(patient.id);
                  const clinicianName =
                    patient.assignedClinicianId === "u2"
                      ? "Dr. Hall"
                      : patient.assignedClinicianId === "u3"
                        ? "Lilian Ike"
                        : patient.assignedClinicianId ?? "Unassigned";

                  return (
                    <tr
                      key={patient.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50/50"
                      style={{ borderBottom: `1px solid var(--card-border)` }}
                      onClick={() => navigate(`/clinical/patients/${patient.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLORS[patient.status] ?? "#6B7280" }}
                          >
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: "var(--topbar-title)" }}>
                              {patient.lastName}, {patient.firstName}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                              DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {patient.mrn}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            backgroundColor: (STATUS_COLORS[patient.status] ?? "#6B7280") + "15",
                            color: STATUS_COLORS[patient.status] ?? "#6B7280",
                          }}
                        >
                          {STATUS_LABELS[patient.status] ?? patient.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                        {clinicianName}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                        {patient.updatedAt
                          ? new Date(patient.updatedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {isOverdue && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium gap-1 text-red-700 border-red-200 bg-red-50"
                            >
                              <AlertTriangle size={10} />
                              Overdue
                            </Badge>
                          )}
                          {isAuthExpiring && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium gap-1 text-amber-700 border-amber-200 bg-amber-50"
                            >
                              <Clock size={10} />
                              Auth Expiring
                            </Badge>
                          )}
                          {!isOverdue && !isAuthExpiring && (
                            <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Active Sessions (supplemental) ──────────────────────────────── */}
        {sessionsData && sessionsData.length > 0 && (
          <div
            className="mt-6 rounded-xl border p-4"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} style={{ color: "#245C5A" }} />
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                Today&apos;s Schedule
              </h2>
              <Badge variant="outline" className="text-[11px]">{sessionsData.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sessionsData.map((session) => {
                const patient = allPatients.find((p) => p.id === session.patientId);
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all"
                    style={{ borderColor: "var(--card-border)" }}
                    onClick={() => navigate(`/clinical/patients/${session.patientId}`)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={15} className="text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                        {patient
                          ? `${patient.lastName}, ${patient.firstName}`
                          : "Unknown Patient"}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {new Date(session.sessionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull;{" "}
                        {session.sessionType} &bull; {session.durationMinutes}min &bull; {session.billingCode ?? "No code"}
                      </p>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals (D007-01, D007-03, D007-04) ──────────────────────────── */}
      <AnimatePresence>{renderModal()}</AnimatePresence>
    </PageLayout>
  );
}

export default ClinicalWorkspacePage;
