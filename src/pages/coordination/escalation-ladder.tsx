import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  readNullableString,
  readNumber,
  readString,
  toRecords,
} from "@/components/data/record-utils";

const TIERS = [
  {
    key: "routine",
    label: "Tier 1: Routine",
    desc: "Standard observation, minor behavioral concern",
    examples: "Missed medication, minor rule infraction, routine status change",
    responder: "RCS Staff",
    responseTime: "During shift",
    color: "bg-green-100 text-green-700 border-green-300",
    bgColor: "bg-green-50",
  },
  {
    key: "clinical",
    label: "Tier 2: Clinical",
    desc: "Behavioral or emotional concern requiring clinical attention",
    examples: "Peer conflict, social withdrawal, mood change, academic decline",
    responder: "MHTCM / Clinician",
    responseTime: "Within 4 hours",
    color: "bg-yellow-100 text-yellow-700 border-yellow-300",
    bgColor: "bg-yellow-50",
  },
  {
    key: "urgent",
    label: "Tier 3: Urgent",
    desc: "Immediate safety or welfare concern",
    examples: "Self-harm ideation, elopement attempt, substance use, serious aggression",
    responder: "Clinical Director + RCS Lead",
    responseTime: "Within 1 hour",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    bgColor: "bg-orange-50",
  },
  {
    key: "crisis",
    label: "Tier 4: Crisis",
    desc: "Active crisis requiring immediate intervention",
    examples: "Active self-harm, violence, medical emergency, elopement",
    responder: "All available staff + Emergency services",
    responseTime: "Immediate",
    color: "bg-red-100 text-red-700 border-red-300",
    bgColor: "bg-red-50",
  },
  {
    key: "post_crisis",
    label: "Tier 5: Post-Crisis",
    desc: "Debrief and stabilization after crisis resolution",
    examples: "Crisis debrief, safety plan review, staff support, documentation",
    responder: "Clinical Director + MHTCM",
    responseTime: "Within 24 hours",
    color: "bg-purple-100 text-purple-700 border-purple-300",
    bgColor: "bg-purple-50",
  },
];

const STATUS_MAP: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  escalating: "bg-red-100 text-red-700",
  de_escalating: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  monitoring: "bg-gray-100 text-gray-700",
};

type EscalationTier = "routine" | "clinical" | "urgent" | "crisis" | "post_crisis";
type TriggerSource =
  | "observation"
  | "staff_report"
  | "family_report"
  | "youth_self_report"
  | "automated_alert";

interface EscalationRecord {
  id: string;
  youth_name: string;
  mrn: string;
  tier: EscalationTier;
  status: string;
  trigger_description: string;
  trigger_source: string | null;
  trigger_detail: string | null;
  response_actions: string | null;
  responder_name: string | null;
  responder_role: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  requires_post_crisis_review: number;
  post_crisis_review_completed: number;
  post_crisis_review_by: string | null;
  post_crisis_review_date: string | null;
}

interface EscalationFormState {
  youthId: string;
  youthName: string;
  tier: EscalationTier;
  triggerSource: TriggerSource;
  triggerDescription: string;
  triggerDetail: string;
}

function normalizeEscalation(value: Record<string, unknown>): EscalationRecord | null {
  const id = readString(value, "id");
  if (!id) return null;
  const rawTier = readString(value, "tier", "routine");
  const tier = TIERS.some((candidate) => candidate.key === rawTier)
    ? rawTier as EscalationTier
    : "routine";
  return {
    id,
    youth_name: readString(value, "youth_name", "Unnamed youth"),
    mrn: readString(value, "mrn"),
    tier,
    status: readString(value, "status", "active"),
    trigger_description: readString(value, "trigger_description"),
    trigger_source: readNullableString(value, "trigger_source"),
    trigger_detail: readNullableString(value, "trigger_detail"),
    response_actions: readNullableString(value, "response_actions"),
    responder_name: readNullableString(value, "responder_name"),
    responder_role: readNullableString(value, "responder_role"),
    resolution_notes: readNullableString(value, "resolution_notes"),
    resolved_at: readNullableString(value, "resolved_at"),
    resolved_by: readNullableString(value, "resolved_by"),
    requires_post_crisis_review: readNumber(value, "requires_post_crisis_review"),
    post_crisis_review_completed: readNumber(value, "post_crisis_review_completed"),
    post_crisis_review_by: readNullableString(value, "post_crisis_review_by"),
    post_crisis_review_date: readNullableString(value, "post_crisis_review_date"),
  };
}

function parseStringArray(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function EscalationLadderPage() {
  const { data: rawEscalations } = trpc.m15.listEscalations.useQuery();
  const escalations = toRecords(rawEscalations).flatMap((escalation) => {
    const normalized = normalizeEscalation(escalation);
    return normalized ? [normalized] : [];
  });
  const activeEscalations = escalations.filter((e) => e.status !== "resolved");
  const resolvedEscalations = escalations.filter((e) => e.status === "resolved");

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Escalation Ladder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            5-tier escalation system for behavioral and safety concerns — SOP Part VIII, Part IX
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">+ New Escalation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log New Escalation</DialogTitle></DialogHeader>
            <NewEscalationForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tier Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            5-Tier Escalation Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {TIERS.map((tier, idx) => (
              <div key={tier.key} className={`flex items-center gap-3 p-3 rounded-lg border ${tier.bgColor} ${tier.color.split(" ")[2]}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                  tier.key === "routine" ? "bg-green-500" :
                  tier.key === "clinical" ? "bg-yellow-500" :
                  tier.key === "urgent" ? "bg-orange-500" :
                  tier.key === "crisis" ? "bg-red-600" : "bg-purple-500"
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{tier.label}</div>
                  <div className="text-xs text-muted-foreground">{tier.desc}</div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-xs font-medium">{tier.responder}</div>
                  <div className="text-xs text-muted-foreground">{tier.responseTime}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Escalations */}
      {activeEscalations.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
            Active Escalations ({activeEscalations.length})
            {activeEscalations.some((e) => e.tier === "crisis") && (
              <Badge className="bg-red-600 text-white animate-pulse">CRISIS ACTIVE</Badge>
            )}
          </div>
          {activeEscalations.map((e) => <EscalationCard key={e.id} escalation={e} />)}
        </div>
      )}

      {/* Resolved Escalations */}
      {resolvedEscalations.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Resolved ({resolvedEscalations.length})</div>
          {resolvedEscalations.map((e) => <EscalationCard key={e.id} escalation={e} />)}
        </div>
      )}

      {escalations.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No escalation events recorded.
        </Card>
      )}
    </div>
  </>
  );
}

function EscalationCard({ escalation: e }: { escalation: EscalationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const tierInfo = TIERS.find(t => t.key === e.tier) ?? TIERS[0];

  const responseActions = parseStringArray(e.response_actions);

  return (
    <Card className={`mb-2 ${e.tier === "crisis" ? "border-red-400" : e.tier === "urgent" ? "border-orange-300" : ""}`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${tierInfo.color} text-xs`}>{tierInfo.label}</Badge>
            <div>
              <div className="text-sm font-medium">{e.youth_name} <span className="text-muted-foreground">({e.mrn})</span></div>
              <div className="text-xs text-muted-foreground">{e.trigger_description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${STATUS_MAP[e.status] ?? "bg-gray-100"} text-xs`}>{e.status}</Badge>
            <span className="text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Trigger Source</Label>
              <div className="capitalize">{e.trigger_source?.replace(/_/g, " ") ?? "Unknown"}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Responder</Label>
              <div>{e.responder_name ?? "Not assigned"} {e.responder_role && `(${e.responder_role})`}</div>
            </div>
            {e.trigger_detail && (
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Detail</Label>
                <div className="text-muted-foreground">{e.trigger_detail}</div>
              </div>
            )}
            {responseActions.length > 0 && (
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Response Actions</Label>
                <ul className="mt-1 space-y-0.5">
                  {responseActions.map((action: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-[#2e8b8b] font-bold shrink-0">{idx + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {e.resolution_notes && (
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Resolution</Label>
                <div className="text-muted-foreground">{e.resolution_notes}</div>
                {e.resolved_at && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Resolved by {e.resolved_by} on {e.resolved_at}
                  </div>
                )}
              </div>
            )}
            {e.requires_post_crisis_review === 1 && (
              <div className={`md:col-span-2 p-2 rounded ${e.post_crisis_review_completed === 1 ? "bg-green-50 border border-green-200" : "bg-purple-50 border border-purple-200"}`}>
                <Label className="text-xs">Post-Crisis Review</Label>
                <div className="text-sm">
                  {e.post_crisis_review_completed === 1
                    ? `Completed by ${e.post_crisis_review_by} on ${e.post_crisis_review_date}`
                    : "REQUIRED — Not yet completed"}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function NewEscalationForm() {
  const [form, setForm] = useState<EscalationFormState>({
    youthId: "", youthName: "", tier: "clinical",
    triggerSource: "observation", triggerDescription: "", triggerDetail: "",
  });

  const createEsc = trpc.m15.createEscalation.useMutation({ onSuccess: () => setForm({ youthId: "", youthName: "", tier: "clinical", triggerSource: "observation", triggerDescription: "", triggerDetail: "" }) });
  const handleSubmit = () => {
    createEsc.mutate({
      youthId: form.youthId || "demo-escalation-youth",
      youthName: form.youthName || "Demo Youth",
      mrn: "DEMO-MRN",
      tier: form.tier,
      triggerSource: form.triggerSource,
      triggerDescription: form.triggerDescription,
      triggerDetail: form.triggerDetail,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Tier *</Label>
        <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v as EscalationTier })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="routine">Tier 1: Routine</SelectItem>
            <SelectItem value="clinical">Tier 2: Clinical</SelectItem>
            <SelectItem value="urgent">Tier 3: Urgent</SelectItem>
            <SelectItem value="crisis">Tier 4: Crisis</SelectItem>
            <SelectItem value="post_crisis">Tier 5: Post-Crisis</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Trigger Source</Label>
        <Select value={form.triggerSource} onValueChange={v => setForm({ ...form, triggerSource: v as TriggerSource })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="observation">Observation</SelectItem>
            <SelectItem value="staff_report">Staff Report</SelectItem>
            <SelectItem value="family_report">Family Report</SelectItem>
            <SelectItem value="youth_self_report">Youth Self-Report</SelectItem>
            <SelectItem value="automated_alert">Automated Alert</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Trigger Description *</Label>
        <Input value={form.triggerDescription} onChange={e => setForm({ ...form, triggerDescription: e.target.value })} placeholder="Brief description of the triggering event" />
      </div>
      <div>
        <Label className="text-xs">Detail</Label>
        <Textarea value={form.triggerDetail} onChange={e => setForm({ ...form, triggerDetail: e.target.value })} rows={3} placeholder="Detailed description of what happened..." />
      </div>
      <Button onClick={handleSubmit} className="w-full bg-red-600 hover:bg-red-700">
        Log Escalation
      </Button>
    </div>
  );
}

export default EscalationLadderPage;
