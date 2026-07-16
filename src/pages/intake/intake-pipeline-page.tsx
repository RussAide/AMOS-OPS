import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface IntakeYouth {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  status: string;
  age: number;
  date_of_birth: string;
  gender: string | null;
  preferred_language: string | null;
  guardian1_name: string;
  guardian1_relationship: string;
  guardian1_phone: string;
  guardian2_name: string | null;
  guardian2_relationship: string | null;
  guardian2_phone: string | null;
  assigned_clinician_name: string | null;
  assigned_case_manager_name: string | null;
  bed_assignment: string | null;
  notes: string | null;
}

interface IntakeRecord {
  current_step: string | null;
  overall_status: string | null;
  is_blocked: number | boolean;
  block_reason: string | null;
  referral_received_completed: number | boolean;
  referral_received_date: string | null;
  referral_received_by: string | null;
  referral_elapsed_hours: number | null;
  referral_received_notes: string | null;
  screening_completed: number | boolean;
  screening_date: string | null;
  screening_completed_by: string | null;
  screening_elapsed_hours: number | null;
  screening_result: string | null;
  screening_notes: string | null;
  consent_completed: number | boolean;
  consent_date: string | null;
  consent_completed_by: string | null;
  consent_elapsed_hours: number | null;
  guardian_consent_obtained: number | boolean;
  youth_assent_obtained: number | boolean;
  hipaa_acknowledgment: number | boolean;
  rights_acknowledgment: number | boolean;
  consent_notes: string | null;
  payer_completed: number | boolean;
  payer_verification_date: string | null;
  payer_verification_completed_by: string | null;
  payer_elapsed_hours: number | null;
  benefits_verified: number | boolean;
  authorization_required: number | boolean;
  authorization_submitted: number | boolean;
  authorization_approved: number | boolean;
  payer_notes: string | null;
  disposition_completed: number | boolean;
  disposition_date: string | null;
  disposition_completed_by: string | null;
  disposition_elapsed_hours: number | null;
  disposition: string | null;
  bed_assigned: string | null;
  admission_scheduled_date: string | null;
  disposition_reason: string | null;
}

interface ReferralChecklist extends Record<string, unknown> {
  items_completed: number;
  items_total: number;
  all_items_complete: number | boolean;
  completed_by: string | null;
  completed_at: string | null;
}

const STEPS = [
  { key: "referral", label: "Referral Received", desc: "Log referral source and initial contact" },
  { key: "screening", label: "Initial Screening", desc: "Clinical screening and risk assessment" },
  { key: "consent", label: "Consent & Legal", desc: "Guardian consent, youth assent, HIPAA" },
  { key: "payer", label: "Payer Verification", desc: "Insurance verification and authorization" },
  { key: "disposition", label: "Disposition", desc: "Admit, deny, waitlist, or refer" },
];

const STEP_ORDER = ["referral", "screening", "consent", "payer", "disposition", "completed"];

function getStepStatus(stepKey: string, currentStep: string) {
  const stepIdx = STEP_ORDER.indexOf(stepKey);
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "current";
  return "pending";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    referral_pending: "bg-yellow-100 text-yellow-800",
    screening: "bg-blue-100 text-blue-800",
    intake: "bg-purple-100 text-purple-800",
    assessment: "bg-orange-100 text-orange-800",
    admitted: "bg-green-100 text-green-800",
    active: "bg-green-100 text-green-800",
    hold: "bg-red-100 text-red-800",
    discharge_planning: "bg-gray-100 text-gray-800",
    discharged: "bg-gray-100 text-gray-600",
    transferred: "bg-gray-100 text-gray-600",
  };
  return <Badge className={map[status] ?? "bg-gray-100"}>{status.replace(/_/g, " ")}</Badge>;
}

export function IntakePipelinePage() {
  const [selectedYouthId, setSelectedYouthId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pipeline");
  const { data: rawYouthList = [] } = trpc.m13.listYouth.useQuery();
  const { data: rawIntakeData } = trpc.m13.getIntakeByYouth.useQuery(
    { youthId: selectedYouthId ?? "" },
    { enabled: !!selectedYouthId }
  );
  const { data: rawChecklistData } = trpc.m13.getChecklist.useQuery(
    { youthId: selectedYouthId ?? "" },
    { enabled: !!selectedYouthId }
  );
  const youthList = rawYouthList as IntakeYouth[];
  const intakeData = rawIntakeData as IntakeRecord | null | undefined;
  const checklistData = rawChecklistData as ReferralChecklist | null | undefined;

  const selectedYouth = youthList.find((y) => y.id === selectedYouthId);

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Youth Intake Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            5-step intake process with timeline enforcement — SOP Part III
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">+ New Referral</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Youth Referral</DialogTitle>
            </DialogHeader>
            <NewReferralForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Youth Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            Select Youth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {youthList.map((youth) => (
              <button
                key={youth.id}
                onClick={() => setSelectedYouthId(youth.id)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedYouthId === youth.id
                    ? "border-[#2e8b8b] bg-[#2e8b8b]/5 ring-1 ring-[#2e8b8b]"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium text-sm">{youth.first_name} {youth.last_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">MRN: {youth.mrn}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={youth.status} />
                  <span className="text-xs text-muted-foreground">Age {youth.age}</span>
                </div>
              </button>
            ))}
            {youthList.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">No youth records found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedYouth && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="pipeline">Intake Pipeline</TabsTrigger>
            <TabsTrigger value="profile">Youth Profile</TabsTrigger>
            <TabsTrigger value="checklist">Referral Checklist (Toolkit 1)</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-4 mt-4">
            <PipelineVisualizer
              intake={intakeData ?? undefined}
            />
          </TabsContent>

          <TabsContent value="profile" className="mt-4">
            <YouthProfileCard youth={selectedYouth} />
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            <ReferralChecklistView checklist={checklistData ?? undefined} youth={selectedYouth} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  </>
  );
}

function PipelineVisualizer({ intake }: { intake: IntakeRecord | undefined }) {
  if (!intake) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No active intake pipeline for this youth.</p>
        <Button className="mt-4 bg-[#2e8b8b] hover:bg-[#1a5a5a]">
          Start Intake Pipeline
        </Button>
      </Card>
    );
  }

  const currentStep = intake.current_step ?? "referral";

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-[#1a3a3a] to-[#2a5a5a] text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#5aaaa4]">Current Step</div>
            <div className="text-lg font-semibold mt-0.5">
              {STEPS.find(s => s.key === currentStep)?.label ?? "Completed"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-[#5aaaa4]">Status</div>
            <div className="text-sm font-medium mt-0.5 capitalize">
              {intake.overall_status?.replace(/_/g, " ") ?? "In Progress"}
              {intake.is_blocked ? " (BLOCKED)" : ""}
            </div>
          </div>
        </div>
        {intake.block_reason && (
          <div className="mt-2 text-sm text-red-300 bg-red-900/30 px-3 py-1.5 rounded">
            Block: {intake.block_reason}
          </div>
        )}
      </div>

      {/* 5-Step Visual Pipeline */}
      <div className="flex flex-col lg:flex-row gap-3">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(step.key, currentStep);
          const isCompleted = status === "completed";
          const isCurrent = status === "current";

          return (
            <div key={step.key} className="flex-1 flex lg:flex-col items-center gap-3">
              {idx > 0 && (
                <div className="hidden lg:block w-full h-0.5 bg-gray-200 -mt-6 mb-2 relative">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all ${
                      isCompleted || isCurrent ? "bg-[#2e8b8b] w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                isCompleted
                  ? "bg-[#2e8b8b] text-white"
                  : isCurrent
                  ? "bg-[#1a3a3a] text-white ring-2 ring-[#2e8b8b] ring-offset-2"
                  : "bg-gray-200 text-gray-500"
              }`}>
                {isCompleted ? "✓" : idx + 1}
              </div>
              <div className="flex-1 lg:text-center">
                <div className={`text-sm font-semibold ${isCurrent ? "text-[#1a3a3a]" : isCompleted ? "text-[#2e8b8b]" : "text-gray-500"}`}>
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground hidden lg:block">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StepDetailCard
          title="Step 1: Referral Received"
          completed={intake.referral_received_completed === 1}
          date={intake.referral_received_date}
          by={intake.referral_received_by}
          elapsed={intake.referral_elapsed_hours}
          timeline="Same day"
        >
          <div className="text-sm text-muted-foreground">{intake.referral_received_notes || "No notes recorded."}</div>
        </StepDetailCard>

        <StepDetailCard
          title="Step 2: Initial Screening"
          completed={intake.screening_completed === 1}
          date={intake.screening_date}
          by={intake.screening_completed_by}
          elapsed={intake.screening_elapsed_hours}
          timeline="Within 1 day"
        >
          {intake.screening_result && (
            <Badge className={
              intake.screening_result === "pass" ? "bg-green-100 text-green-800" :
              intake.screening_result === "fail" ? "bg-red-100 text-red-800" :
              "bg-yellow-100 text-yellow-800"
            }>
              Result: {intake.screening_result}
            </Badge>
          )}
          <div className="text-sm text-muted-foreground mt-1">{intake.screening_notes || "No screening notes."}</div>
        </StepDetailCard>

        <StepDetailCard
          title="Step 3: Consent & Legal"
          completed={intake.consent_completed === 1}
          date={intake.consent_date}
          by={intake.consent_completed_by}
          elapsed={intake.consent_elapsed_hours}
          timeline="Within 72 hours"
        >
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ConsentItem label="Guardian Consent" checked={intake.guardian_consent_obtained === 1} />
            <ConsentItem label="Youth Assent" checked={intake.youth_assent_obtained === 1} />
            <ConsentItem label="HIPAA Acknowledgment" checked={intake.hipaa_acknowledgment === 1} />
            <ConsentItem label="Rights Acknowledgment" checked={intake.rights_acknowledgment === 1} />
          </div>
          <div className="text-sm text-muted-foreground mt-2">{intake.consent_notes || ""}</div>
        </StepDetailCard>

        <StepDetailCard
          title="Step 4: Payer Verification"
          completed={intake.payer_completed === 1}
          date={intake.payer_verification_date}
          by={intake.payer_verification_completed_by}
          elapsed={intake.payer_elapsed_hours}
          timeline="Within 7 days"
        >
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ConsentItem label="Benefits Verified" checked={intake.benefits_verified === 1} />
            <ConsentItem label="Auth Required" checked={intake.authorization_required === 1} />
            <ConsentItem label="Auth Submitted" checked={intake.authorization_submitted === 1} />
            <ConsentItem label="Auth Approved" checked={intake.authorization_approved === 1} />
          </div>
          <div className="text-sm text-muted-foreground mt-2">{intake.payer_notes || ""}</div>
        </StepDetailCard>

        <StepDetailCard
          title="Step 5: Disposition"
          completed={intake.disposition_completed === 1}
          date={intake.disposition_date}
          by={intake.disposition_completed_by}
          elapsed={intake.disposition_elapsed_hours}
          timeline="Within 7 days"
        >
          {intake.disposition && (
            <Badge className={
              intake.disposition === "admit" ? "bg-green-100 text-green-800" :
              intake.disposition === "deny" ? "bg-red-100 text-red-800" :
              intake.disposition === "waitlist" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }>
              {intake.disposition}
            </Badge>
          )}
          {intake.bed_assigned && (
            <div className="text-xs text-muted-foreground mt-1">Bed: {intake.bed_assigned}</div>
          )}
          {intake.admission_scheduled_date && (
            <div className="text-xs text-muted-foreground">Admission: {intake.admission_scheduled_date}</div>
          )}
          <div className="text-sm text-muted-foreground mt-1">{intake.disposition_reason || ""}</div>
        </StepDetailCard>
      </div>
    </div>
  );
}

function StepDetailCard({ title, completed, date, by, elapsed, timeline, children }: {
  title: string; completed: boolean; date?: string | null; by?: string | null;
  elapsed?: number | null; timeline: string; children: React.ReactNode;
}) {
  return (
    <Card className={completed ? "border-[#2e8b8b]/30" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {completed ? (
            <Badge className="bg-[#2e8b8b] text-white text-xs">Completed</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Pending</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Expected: {timeline}</span>
          {elapsed != null && elapsed > 0 && <span>Elapsed: {elapsed}h</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {date && <div className="text-xs text-muted-foreground mb-2">{date} {by ? `by ${by}` : ""}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

function ConsentItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-4 h-4 rounded flex items-center justify-center text-xs ${
        checked ? "bg-[#2e8b8b] text-white" : "bg-gray-200"
      }`}>
        {checked ? "✓" : ""}
      </div>
      <span className={checked ? "text-green-700" : "text-gray-500"}>{label}</span>
    </div>
  );
}

function YouthProfileCard({ youth }: { youth: IntakeYouth }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{youth.first_name} {youth.last_name}</CardTitle>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={youth.status} />
          <span className="text-sm text-muted-foreground">MRN: {youth.mrn}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><Label className="text-xs text-muted-foreground">Age</Label><div>{youth.age}</div></div>
          <div><Label className="text-xs text-muted-foreground">DOB</Label><div>{youth.date_of_birth}</div></div>
          <div><Label className="text-xs text-muted-foreground">Gender</Label><div className="capitalize">{youth.gender}</div></div>
          <div><Label className="text-xs text-muted-foreground">Language</Label><div>{youth.preferred_language ?? "English"}</div></div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Guardian 1</Label>
            <div className="font-medium">{youth.guardian1_name}</div>
            <div className="text-muted-foreground">{youth.guardian1_relationship} · {youth.guardian1_phone}</div>
          </div>
          {youth.guardian2_name && (
            <div>
              <Label className="text-xs text-muted-foreground">Guardian 2</Label>
              <div className="font-medium">{youth.guardian2_name}</div>
              <div className="text-muted-foreground">{youth.guardian2_relationship} · {youth.guardian2_phone}</div>
            </div>
          )}
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Assigned Clinician</Label>
            <div>{youth.assigned_clinician_name ?? "Not assigned"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Case Manager</Label>
            <div>{youth.assigned_case_manager_name ?? "Not assigned"}</div>
          </div>
        </div>
        {youth.bed_assignment && (
          <>
            <Separator />
            <div className="text-sm">
              <Label className="text-xs text-muted-foreground">Bed Assignment</Label>
              <div>{youth.bed_assignment}</div>
            </div>
          </>
        )}
        {youth.notes && (
          <>
            <Separator />
            <div className="text-sm">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <div className="text-muted-foreground">{youth.notes}</div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralChecklistView({ checklist, youth }: { checklist: ReferralChecklist | undefined; youth: IntakeYouth }) {
  if (!checklist) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No referral checklist found for {youth.first_name} {youth.last_name}.</p>
        <Button className="mt-4 bg-[#2e8b8b] hover:bg-[#1a5a5a]">Create Checklist</Button>
      </Card>
    );
  }

  const items = [
    { key: "item1_referral_form_received", label: "Referral form received from source" },
    { key: "item2_demographics_complete", label: "Demographics complete and verified" },
    { key: "item3_insurance_verified", label: "Insurance eligibility verified" },
    { key: "item4_consent_for_release", label: "Consent for release of information signed" },
    { key: "item5_psychiatric_history", label: "Psychiatric history documented" },
    { key: "item6_medical_records_requested", label: "Medical records requested from providers" },
    { key: "item7_educational_records_requested", label: "Educational records requested from school" },
    { key: "item8_legal_status_confirmed", label: "Legal status / custody confirmed" },
    { key: "item9_guardian_contact_verified", label: "Guardian contact information verified" },
    { key: "item10_service_activation_date_set", label: "Service activation date set" },
  ] as const;

  const completed = checklist.items_completed ?? 0;
  const total = checklist.items_total ?? 10;
  const pct = Math.round((completed / total) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Referral &amp; Service Activation Checklist</CardTitle>
            <p className="text-sm text-muted-foreground">SOP Toolkit 1 — 10 required items</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#1a3a3a]">{completed}/{total}</div>
            <div className="text-xs text-muted-foreground">{pct}% complete</div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-[#2e8b8b] h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, idx) => {
          const checked = checklist[item.key] === 1;
          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                checked ? "border-[#2e8b8b]/30 bg-[#2e8b8b]/5" : "border-gray-200"
              }`}
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold shrink-0 ${
                checked ? "bg-[#2e8b8b] text-white" : "bg-gray-200 text-gray-500"
              }`}>
                {checked ? "✓" : idx + 1}
              </div>
              <span className={`text-sm ${checked ? "text-green-700 line-through" : ""}`}>
                {item.label}
              </span>
            </div>
          );
        })}
        {checklist.all_items_complete === 1 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 text-center">
            All items completed by {checklist.completed_by} on {checklist.completed_at}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewReferralForm() {
  const createIntake = trpc.m13.createIntake.useMutation();
  const createYouth = trpc.m13.createYouth.useMutation({
    onSuccess: (youth, variables) => {
      createIntake.mutate({
        youthId: youth.id,
        mrn: variables.mrn,
        youthName: `${variables.firstName} ${variables.lastName}`,
      });
    },
  });
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", age: "",
    gender: "male" as string, guardian1Name: "", guardian1Relationship: "", guardian1Phone: "",
    referralSource: "school" as string, notes: "",
  });

  const handleSubmit = () => {
    createYouth.mutate({
      mrn: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth,
      age: Number(form.age),
      gender: form.gender as Parameters<typeof createYouth.mutate>[0]["gender"],
      guardian1Name: form.guardian1Name,
      guardian1Relationship: form.guardian1Relationship,
      guardian1Phone: form.guardian1Phone,
      referralSourceType: form.referralSource as Parameters<typeof createYouth.mutate>[0]["referralSourceType"],
      notes: form.notes || undefined,
    });
  };

  return (
    <>

      <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">First Name *</Label>
          <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Last Name *</Label>
          <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date of Birth *</Label>
          <Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Age *</Label>
          <Input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Gender</Label>
        <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="non_binary">Non-binary</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-xs">Guardian Name *</Label>
        <Input value={form.guardian1Name} onChange={e => setForm({ ...form, guardian1Name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Relationship *</Label>
          <Input value={form.guardian1Relationship} onChange={e => setForm({ ...form, guardian1Relationship: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Phone *</Label>
          <Input value={form.guardian1Phone} onChange={e => setForm({ ...form, guardian1Phone: e.target.value })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Referral Source</Label>
        <Select value={form.referralSource} onValueChange={v => setForm({ ...form, referralSource: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="school">School</SelectItem>
            <SelectItem value="dcf">DCF</SelectItem>
            <SelectItem value="hospital">Hospital</SelectItem>
            <SelectItem value="court">Court</SelectItem>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="self">Self</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>
      <Button onClick={handleSubmit} className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]">
        Create Referral
      </Button>
    </div>
    </>
  );
}

export default IntakePipelinePage;
