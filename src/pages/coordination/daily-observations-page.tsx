import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const DOMAINS = [
  { key: "domain1Safety", label: "Safety & Compliance", desc: "No safety concerns, follows rules" },
  { key: "domain2Regulation", label: "Emotional Regulation", desc: "Coping skills, emotional control" },
  { key: "domain3Functioning", label: "Daily Functioning", desc: "ADLs, routine completion" },
  { key: "domain4Medication", label: "Medication", desc: "Med compliance, side effects" },
  { key: "domain5Relationships", label: "Peer Relationships", desc: "Social interaction, peer engagement" },
  { key: "domain6Participation", label: "Activity Participation", desc: "Group engagement, program involvement" },
];

const SCORE_LABELS: Record<number, string> = { 0: "No Concern", 1: "Mild", 2: "Moderate", 3: "Severe" };
const SCORE_COLORS: Record<number, string> = { 0: "bg-green-500", 1: "bg-yellow-500", 2: "bg-orange-500", 3: "bg-red-500" };

export function DailyObservationsPage() {
  const [selectedYouthId, setSelectedYouthId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("today");
  const { data: observations = [] } = trpc.m15.listObservations.useQuery();
  const { data: youthList = [] } = trpc.m13.listYouth.useQuery();

  // Filter by selected youth if any
  const filteredObs = selectedYouthId
    ? observations.filter((o: any) => o.youth_id === selectedYouthId)
    : observations;

  // Group by date
  const byDate = filteredObs.reduce((acc: Record<string, any[]>, o: any) => {
    const date = o.observation_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(o);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Daily BHC-GRO Observations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6-domain structured observation with clinical routing — SOP Part VIII, Toolkit 4
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">+ New Observation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Daily Observation</DialogTitle></DialogHeader>
            <NewObservationForm youthList={youthList} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <ObservationSummary />

      {/* Youth Filter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            Filter by Youth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedYouthId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !selectedYouthId ? "bg-[#2e8b8b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Youth
            </button>
            {youthList.map((y: any) => (
              <button
                key={y.id}
                onClick={() => setSelectedYouthId(y.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedYouthId === y.id ? "bg-[#2e8b8b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {y.first_name} {y.last_name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Observations by Date */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All Observations</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3 mt-4">
          {Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).slice(0, 1).map(([date, obs]: [string, any]) => (
            <div key={date}>
              <div className="text-sm font-semibold text-[#1a3a3a] mb-2">{date}</div>
              {obs.map((o: any) => <ObservationCard key={o.id} observation={o} />)}
            </div>
          ))}
          {filteredObs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No observations recorded.</p>}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-4">
          {Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, obs]: [string, any]) => (
            <div key={date}>
              <div className="text-sm font-semibold text-[#1a3a3a] mb-2">{date}</div>
              {obs.map((o: any) => <ObservationCard key={o.id} observation={o} />)}
            </div>
          ))}
          {filteredObs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No observations recorded.</p>}
        </TabsContent>
      </Tabs>
    </div>
  </>
  );
}

function ObservationSummary() {
  const { data: summary } = trpc.m15.coordinationSummary.useQuery();
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[
        { label: "Today's Obs", value: summary.todayObservations, color: "text-[#1a3a3a]" },
        { label: "Pending Clinical", value: summary.pendingClinicalResponses, color: summary.pendingClinicalResponses > 0 ? "text-red-600" : "text-green-600" },
        { label: "Today's Meetings", value: summary.todaysMeetings, color: "text-[#1a3a3a]" },
        { label: "Open Actions", value: summary.openActionItems, color: summary.openActionItems > 0 ? "text-orange-600" : "text-green-600" },
        { label: "Active Escalations", value: summary.activeEscalations, color: summary.activeEscalations > 0 ? "text-red-600" : "text-green-600" },
      ].map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ObservationCard({ observation: o }: { observation: any }) {
  const [expanded, setExpanded] = useState(false);
  const domainScores = [
    o.domain1_safety_score, o.domain2_regulation_score, o.domain3_functioning_score,
    o.domain4_medication_score, o.domain5_relationships_score, o.domain6_participation_score,
  ];
  const avgScore = domainScores.filter((s: any) => s !== null && s !== undefined).reduce((a: number, b: any) => a + b, 0) /
    Math.max(1, domainScores.filter((s: any) => s !== null && s !== undefined).length);

  return (
    <Card className={o.clinically_significant === 1 ? "border-red-300 bg-red-50/30" : ""}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              avgScore < 1 ? "bg-green-500" : avgScore < 2 ? "bg-yellow-500" : avgScore < 2.5 ? "bg-orange-500" : "bg-red-500"
            }`}>
              {avgScore.toFixed(1)}
            </div>
            <div>
              <div className="font-medium text-sm">{o.youth_name} <span className="text-muted-foreground">({o.mrn})</span></div>
              <div className="text-xs text-muted-foreground">
                {o.observation_date} · {o.shift} shift · By {o.observed_by}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {o.clinically_significant === 1 && (
              <Badge className="bg-red-100 text-red-700 text-xs">Clinically Significant</Badge>
            )}
            {o.routed_to_clinician === 1 && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">Routed to {o.routed_to_clinician_name}</Badge>
            )}
            <span className="text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 border-t">
          {/* 6 Domain Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {DOMAINS.map((d, idx) => {
              const score = domainScores[idx];
              const notesKey = `domain${idx + 1}_${d.key.replace("domain", "").toLowerCase()}_notes`;
              const notes = o[notesKey as keyof typeof o] as string;
              return (
                <div key={d.key} className={`p-2.5 rounded border ${
                  score !== null && score !== undefined && score >= 2 ? "border-orange-300 bg-orange-50/50" : "border-gray-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{d.label}</span>
                    {score !== null && score !== undefined ? (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${SCORE_COLORS[score]}`}>
                        {score}
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </div>
                  {notes && <div className="text-xs text-muted-foreground mt-1">{notes}</div>}
                </div>
              );
            })}
          </div>

          {o.clinical_concerns && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              <span className="font-semibold">Clinical Concerns:</span> {o.clinical_concerns}
            </div>
          )}

          {o.clinician_response && (
            <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <span className="font-semibold">{o.routed_to_clinician_name} responded:</span> {o.clinician_response}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewObservationForm({ youthList }: { youthList: any[] }) {
  const [form, setForm] = useState({
    youthId: "", shift: "day" as string, observationDate: new Date().toISOString().split("T")[0],
    domainNotes: ["", "", "", "", "", ""], domainScores: [0, 0, 0, 0, 0, 0],
    clinicalConcerns: "",
  });

  const selectedYouth = youthList.find((y: any) => y.id === form.youthId);

  const utils = trpc.useUtils();
  const createObs = trpc.m15.createObservation.useMutation({
    onSuccess: () => { utils.m15.listObservations.invalidate(); setForm({ youthId: "", shift: "day", observationDate: new Date().toISOString().split("T")[0], domainNotes: ["", "", "", "", "", ""], domainScores: [0, 0, 0, 0, 0, 0], clinicalConcerns: "" }); },
  });

  const handleSubmit = () => {
    if (!form.youthId || !selectedYouth) return;
    createObs.mutate({
      youthId: form.youthId, youthName: selectedYouth.first_name + " " + selectedYouth.last_name,
      mrn: selectedYouth.mrn, observation_date: form.observationDate, shift: form.shift,
      observed_by: "Current User", observed_by_id: "u-current",
      behavior_type: "routine_observation", domain1_safety: form.domainScores[0], domain1_safety_notes: form.domainNotes[0],
      domain2_regulation: form.domainScores[1], domain2_regulation_notes: form.domainNotes[1],
      domain3_functioning: form.domainScores[2], domain3_functioning_notes: form.domainNotes[2],
      domain4_medication: form.domainScores[3], domain4_medication_notes: form.domainNotes[3],
      domain5_relationships: form.domainScores[4], domain5_relationships_notes: form.domainNotes[4],
      domain6_participation: form.domainScores[5], domain6_participation_notes: form.domainNotes[5],
      clinically_significant: form.domainScores.some((s: number) => s >= 2) ? 1 : 0,
      clinical_concerns: form.clinicalConcerns, routed_to_clinician: 0,
    } as any);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Youth *</Label>
        <Select value={form.youthId} onValueChange={v => setForm({ ...form, youthId: v })}>
          <SelectTrigger><SelectValue placeholder="Select youth" /></SelectTrigger>
          <SelectContent>
            {youthList.map((y: any) => (
              <SelectItem key={y.id} value={y.id}>{y.first_name} {y.last_name} ({y.mrn})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedYouth && (
        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
          {selectedYouth.first_name} {selectedYouth.last_name} · Age {selectedYouth.age} · Bed: {selectedYouth.bed_assignment ?? "Unassigned"}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={form.observationDate} onChange={e => setForm({ ...form, observationDate: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Shift</Label>
          <Select value={form.shift} onValueChange={v => setForm({ ...form, shift: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
              <SelectItem value="overnight">Overnight</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="text-xs font-semibold text-[#1a3a3a]">6-Domain Assessment</div>
      {DOMAINS.map((d, idx) => (
        <div key={d.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{d.label}</Label>
            <Select
              value={String(form.domainScores[idx])}
              onValueChange={v => {
                const newScores = [...form.domainScores];
                newScores[idx] = Number(v);
                setForm({ ...form, domainScores: newScores });
              }}
            >
              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 — No Concern</SelectItem>
                <SelectItem value="1">1 — Mild</SelectItem>
                <SelectItem value="2">2 — Moderate</SelectItem>
                <SelectItem value="3">3 — Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder={`Notes for ${d.label.toLowerCase()}...`}
            value={form.domainNotes[idx]}
            onChange={e => {
              const newNotes = [...form.domainNotes];
              newNotes[idx] = e.target.value;
              setForm({ ...form, domainNotes: newNotes });
            }}
            className="text-xs min-h-[40px]"
          />
        </div>
      ))}
      <Separator />
      <div>
        <Label className="text-xs">Clinical Concerns (if any)</Label>
        <Textarea value={form.clinicalConcerns} onChange={e => setForm({ ...form, clinicalConcerns: e.target.value })} placeholder="Describe any clinical concerns that require clinician attention..." />
      </div>
      <Button onClick={handleSubmit} className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]">
        Submit Observation
      </Button>
    </div>
  );
}

// Need to import Input for the date picker
import { Input } from "@/components/ui/input";

export default DailyObservationsPage;
