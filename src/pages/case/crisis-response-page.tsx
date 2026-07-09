import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CRISIS_TYPES: Record<string, { label: string; color: string }> = {
  behavioral_escalation: { label: "Behavioral Escalation", color: "bg-orange-100 text-orange-700" },
  suicide_self_harm: { label: "Suicide / Self-Harm", color: "bg-red-100 text-red-700" },
  medical_emergency: { label: "Medical Emergency", color: "bg-blue-100 text-blue-700" },
  elopement: { label: "Elopement", color: "bg-purple-100 text-purple-700" },
  substance_intoxication: { label: "Substance Intoxication", color: "bg-yellow-100 text-yellow-700" },
};

const STATUS_MAP: Record<string, string> = {
  active: "bg-red-100 text-red-700",
  contained: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  under_review: "bg-blue-100 text-blue-700",
};

const STEPS = [
  { num: 1, label: "Crisis Identified", desc: "Staff recognizes crisis indicators" },
  { num: 2, label: "Protocol Activated", desc: "Crisis response team mobilized" },
  { num: 3, label: "Immediate Response", desc: "De-escalation and intervention" },
  { num: 4, label: "Safety Ensured", desc: "Youth and others made safe" },
  { num: 5, label: "Notifications", desc: "Required parties notified" },
  { num: 6, label: "Documented", desc: "All actions documented" },
  { num: 7, label: "Reviewed", desc: "Post-crisis review and debrief" },
];

export function CrisisResponsePage() {
  const [selectedCrisisId, setSelectedCrisisId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const { data: crises = [] } = trpc.m17.listCrises.useQuery();
  const { data: summary } = trpc.m17.crisisSummary.useQuery();
  const { data: crisisDetail } = trpc.m17.getCrisis.useQuery(
    { id: selectedCrisisId ?? "" },
    { enabled: !!selectedCrisisId }
  );

  const activeCrises = crises.filter((c: any) => c.overall_status !== "resolved");
  const resolvedCrises = crises.filter((c: any) => c.overall_status === "resolved");

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Crisis Response SOP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            5 crisis types, 7-step workflow, post-crisis debrief — SOP Part IX, Toolkit 6
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">+ Activate Crisis Protocol</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Activate Crisis Protocol</DialogTitle></DialogHeader>
            <NewCrisisForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Active Crises", value: summary.activeCrises, color: summary.activeCrises > 0 ? "text-red-600" : "text-green-600" },
            { label: "Under Review", value: summary.underReview, color: "text-[#1a3a3a]" },
            { label: "Resolved Today", value: summary.resolvedToday, color: "text-green-600" },
            { label: "This Month", value: summary.totalThisMonth, color: "text-[#1a3a3a]" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Crisis Type Breakdown */}
      {summary && summary.byType.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.byType.map((t: any) => {
            const info = CRISIS_TYPES[t.crisis_type] ?? { label: t.crisis_type, color: "bg-gray-100" };
            return <Badge key={t.crisis_type} className={`${info.color} text-xs`}>{info.label}: {t.c}</Badge>;
          })}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="active">Active ({activeCrises.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedCrises.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeCrises.map((c: any) => (
            <CrisisCard key={c.id} crisis={c} selected={selectedCrisisId === c.id} onClick={() => setSelectedCrisisId(c.id === selectedCrisisId ? null : c.id)} />
          ))}
          {activeCrises.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No active crises.</p>}
          {crisisDetail && selectedCrisisId && crisisDetail.overall_status !== "resolved" && <CrisisDetail crisis={crisisDetail} />}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-3 mt-4">
          {resolvedCrises.map((c: any) => (
            <CrisisCard key={c.id} crisis={c} selected={selectedCrisisId === c.id} onClick={() => setSelectedCrisisId(c.id === selectedCrisisId ? null : c.id)} />
          ))}
          {resolvedCrises.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No resolved crises.</p>}
          {crisisDetail && selectedCrisisId && crisisDetail.overall_status === "resolved" && <CrisisDetail crisis={crisisDetail} />}
        </TabsContent>
      </Tabs>
    </div>
  </>
  );
}

function CrisisCard({ crisis: c, selected, onClick }: { crisis: any; selected: boolean; onClick: () => void }) {
  const typeInfo = CRISIS_TYPES[c.crisis_type] ?? { label: c.crisis_type, color: "bg-gray-100" };
  const stepPct = Math.min(100, ((c.current_step - 1) / 7) * 100);

  return (
    <Card
      className={`cursor-pointer transition-all ${selected ? "border-red-400 ring-1 ring-red-400" : c.overall_status === "active" ? "border-red-200" : "border-gray-200"}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
            <span className="text-sm font-medium">{c.youth_name} <span className="text-muted-foreground">({c.mrn})</span></span>
          </div>
          <Badge className={`${STATUS_MAP[c.overall_status] ?? "bg-gray-100"} text-xs`}>{c.overall_status}</Badge>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Step {Math.min(c.current_step, 7)} of 7</span>
            <span>{c.step1_identified_by ? `Identified by ${c.step1_identified_by}` : ""}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${stepPct}%` }} />
          </div>
        </div>
        {c.restrictive_intervention_used === 1 && (
          <div className="mt-1 text-xs text-red-600 font-medium">
            Restrictive intervention used: {c.restrictive_intervention_type}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CrisisDetail({ crisis: c }: { crisis: any }) {
  const [showDebrief, setShowDebrief] = useState(false);

  let responseActions: string[] = []; try { responseActions = JSON.parse(c.step3_response_actions ?? "[]"); } catch { /* */ }
  let notifiedParties: string[] = []; try { notifiedParties = JSON.parse(c.step5_notified_parties ?? "[]"); } catch { /* */ }

  return (
    <div className="space-y-4">
      {/* 7-Step Workflow */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-red-700">
            7-Step Crisis Response Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {STEPS.map((step) => {
            const isCompleted = c.current_step > step.num || (c.current_step === 8 && step.num <= 7);
            const isCurrent = c.current_step === step.num;
            const timeField = `step${step.num}_${step.label.toLowerCase().replace(/ /g, "_")}_at` as keyof typeof c;
            const byField = `step${step.num}_${step.label.toLowerCase().replace(/ /g, "_")}_by` as keyof typeof c;
            const notesField = `step${step.num}_${step.label.toLowerCase().replace(/ /g, "_")}_notes` as keyof typeof c;

            return (
              <div key={step.num} className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                isCompleted ? "border-green-300 bg-green-50" : isCurrent ? "border-red-300 bg-red-50" : "border-gray-200 opacity-50"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                  isCompleted ? "bg-green-500" : isCurrent ? "bg-red-500 animate-pulse" : "bg-gray-300"
                }`}>
                  {isCompleted ? "✓" : step.num}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${isCurrent ? "text-red-700" : ""}`}>{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.desc}</div>
                  {isCompleted && c[timeField as string] && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c[timeField as string]} {c[byField as string] && `by ${c[byField as string]}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Response Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {responseActions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Response Actions</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {responseActions.map((action: string, idx: number) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-[#2e8b8b] font-bold shrink-0">{idx + 1}.</span>{action}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {notifiedParties.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Notifications</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {notifiedParties.map((party: string, idx: number) => (
                  <div key={idx} className="text-sm flex items-center gap-2">
                    <span className="text-green-600">✓</span>{party}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {c.step4_safety_measures && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Safety Measures</CardTitle></CardHeader>
          <CardContent><div className="text-sm text-muted-foreground">{c.step4_safety_measures}</div></CardContent>
        </Card>
      )}

      {c.step7_review_notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Review Notes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">{c.step7_review_notes}</div>
            <div className="text-xs text-muted-foreground mt-1">Reviewed by {c.step7_reviewed_by} on {c.step7_reviewed_at}</div>
          </CardContent>
        </Card>
      )}

      {/* Crisis Debrief */}
      {c.debrief && (
        <Card className="border-[#2e8b8b]/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
                Crisis Debrief (SOP Toolkit 6)
              </CardTitle>
              {c.debrief.completed_at && <Badge className="bg-green-100 text-green-700">Completed</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <DebriefField label="Event Summary" value={c.debrief.field1_event_summary} />
            <DebriefField label="Triggers Identified" value={c.debrief.field2_triggers_identified} />
            <DebriefField label="Early Warning Signs" value={c.debrief.field3_early_warning_signs} />
            <DebriefField label="Interventions Used" value={c.debrief.field4_interventions_used} />
            <DebriefField label="What Worked" value={c.debrief.field5_what_worked} />
            <DebriefField label="What Did Not Work" value={c.debrief.field6_what_did_not_work} />
            <DebriefField label="Youth Perspective" value={c.debrief.field7_youth_perspective} />
            <DebriefField label="Staff Perspective" value={c.debrief.field8_staff_perspective} />
            <DebriefField label="Plan Adjustments" value={c.debrief.field9_plan_adjustments} />

            {c.debrief.safety_plan_updated === 1 && (
              <div className="p-2.5 bg-green-50 border border-green-200 rounded">
                <Label className="text-xs text-green-700">Safety Plan Updated</Label>
                <div className="text-sm text-muted-foreground">{c.debrief.safety_plan_changes}</div>
              </div>
            )}

            {c.debrief.follow_up_required === 1 && (
              <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded">
                <Label className="text-xs text-yellow-700">Follow-up Required by {c.debrief.follow_up_date}</Label>
                <div className="text-sm text-muted-foreground">{c.debrief.follow_up_actions}</div>
              </div>
            )}

            {c.debrief.completed_at && (
              <div className="text-xs text-muted-foreground text-center">
                Debrief completed by {c.debrief.completed_by} on {c.debrief.completed_at}
                {c.debrief.reviewed_by && ` · Reviewed by ${c.debrief.reviewed_by} on ${c.debrief.reviewed_at}`}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DebriefField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <Label className="text-xs text-[#2e8b8b] font-semibold">{label}</Label>
      <div className="text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function NewCrisisForm() {
  const [form, setForm] = useState({
    youthId: "", youthName: "", crisisType: "behavioral_escalation" as string,
  });

  const utils = trpc.useUtils();
  const createCrisis = trpc.m17.createCrisis.useMutation({ onSuccess: () => { utils.m17.listCrises.invalidate(); setForm({ youthId: "", youthName: "", crisisType: "behavioral_escalation" }); } });
  const handleSubmit = () => { createCrisis.mutate({ youthName: form.youthName, crisisType: form.crisisType, description: "Crisis response activated", time: new Date().toTimeString().slice(0,5), location: "Unit", staffResponse: "Protocol activated", category: "crisis", severity: "high" } as any); };

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
        This activates the 7-step crisis response protocol. Use only for actual crisis events.
      </div>
      <div>
        <Label className="text-xs">Youth Name *</Label>
        <input className="w-full border rounded px-2 py-1 text-sm" value={form.youthName} onChange={e => setForm({ ...form, youthName: e.target.value })} placeholder="Enter youth name" />
      </div>
      <div>
        <Label className="text-xs">Crisis Type *</Label>
        <select className="w-full border rounded px-2 py-1 text-sm" value={form.crisisType} onChange={e => setForm({ ...form, crisisType: e.target.value })}>
          <option value="behavioral_escalation">Behavioral Escalation</option>
          <option value="suicide_self_harm">Suicide / Self-Harm</option>
          <option value="medical_emergency">Medical Emergency</option>
          <option value="elopement">Elopement</option>
          <option value="substance_intoxication">Substance Intoxication</option>
        </select>
      </div>
      <Button onClick={handleSubmit} className="w-full bg-red-600 hover:bg-red-700">
        Activate Protocol
      </Button>
    </div>
  );
}

export default CrisisResponsePage;
