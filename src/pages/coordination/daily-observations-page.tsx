import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  readNullableString,
  readNumber,
  readString,
  toRecords,
} from "@/components/data/record-utils";

const DOMAINS = [
  {
    label: "Safety & Compliance",
    description: "Observed safety conditions and rule-following behavior",
    storageNotes: "domain1_safety_notes",
  },
  {
    label: "Emotional Regulation",
    description: "Observed coping and emotional-regulation behavior",
    storageNotes: "domain2_regulation_notes",
  },
  {
    label: "Daily Functioning",
    description: "Observed routines, activities, and daily functioning",
    storageNotes: "domain3_functioning_notes",
  },
  {
    label: "Medication",
    description: "Observed adherence, refusal, or possible side effects",
    storageNotes: "domain4_medication_notes",
  },
  {
    label: "Peer Relationships",
    description: "Observed social interaction and peer engagement",
    storageNotes: "domain5_relationships_notes",
  },
  {
    label: "Activity Participation",
    description: "Observed group and program participation",
    storageNotes: "domain6_participation_notes",
  },
] as const;

type ObservationShift = "day" | "evening" | "night" | "overnight";

interface YouthRecord {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  age: number;
  bed_assignment: string | null;
}

interface ObservationRecord extends Record<string, unknown> {
  id: string;
  youth_id: string;
  youth_name: string;
  mrn: string;
  observation_date: string;
  shift: string;
  observed_by: string;
  clinical_concerns: string | null;
  clinician_response: string | null;
}

interface ObservationFormState {
  youthId: string;
  shift: ObservationShift;
  observationDate: string;
  domainNotes: string[];
  clinicalConcerns: string;
}

function blankObservationForm(): ObservationFormState {
  return {
    youthId: "",
    shift: "day",
    observationDate: new Date().toISOString().split("T")[0],
    domainNotes: ["", "", "", "", "", ""],
    clinicalConcerns: "",
  };
}

function normalizeYouth(value: Record<string, unknown>): YouthRecord | null {
  const id = readString(value, "id");
  if (!id) return null;
  return {
    id,
    first_name: readString(value, "first_name", "Unnamed"),
    last_name: readString(value, "last_name"),
    mrn: readString(value, "mrn"),
    age: readNumber(value, "age"),
    bed_assignment: readNullableString(value, "bed_assignment"),
  };
}

function normalizeObservation(
  value: Record<string, unknown>,
): ObservationRecord | null {
  const id = readString(value, "id");
  if (!id) return null;
  return {
    ...value,
    id,
    youth_id: readString(value, "youth_id"),
    youth_name: readString(value, "youth_name", "Unnamed youth"),
    mrn: readString(value, "mrn"),
    observation_date: readString(value, "observation_date"),
    shift: readString(value, "shift", "day"),
    observed_by: readString(value, "observed_by", "Unknown"),
    clinical_concerns: readNullableString(value, "clinical_concerns"),
    clinician_response: readNullableString(value, "clinician_response"),
  };
}

export function DailyObservationsPage() {
  const [selectedYouthId, setSelectedYouthId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("today");
  const { data: rawObservations } = trpc.m15.listObservations.useQuery();
  const { data: rawYouthList } = trpc.m13.listYouth.useQuery();
  const observations = toRecords(rawObservations).flatMap((value) => {
    const normalized = normalizeObservation(value);
    return normalized ? [normalized] : [];
  });
  const youthList = toRecords(rawYouthList).flatMap((value) => {
    const normalized = normalizeYouth(value);
    return normalized ? [normalized] : [];
  });
  const filtered = selectedYouthId
    ? observations.filter(
        (observation) => observation.youth_id === selectedYouthId,
      )
    : observations;
  const byDate = filtered.reduce<Record<string, ObservationRecord[]>>(
    (groups, observation) => {
      groups[observation.observation_date] ??= [];
      groups[observation.observation_date].push(observation);
      return groups;
    },
    {},
  );

  return (
    <main
      className="space-y-6"
      data-testid="m41c-narrative-observation-workspace"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">
            Daily BHC-GRO Narrative Observations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Six-domain narrative documentation with explicit staff-requested
            clinician attention.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">
              + New Observation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Narrative Observation</DialogTitle>
            </DialogHeader>
            <NewObservationForm youthList={youthList} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="p-4 text-sm leading-6 text-emerald-950">
          Numeric domain scoring, averaged significance thresholds, and
          score-driven routing are quarantined. Staff document what they
          observed and explicitly describe any concern that requires human
          clinician attention.
        </CardContent>
      </Card>

      <ObservationSummary />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            Filter by Youth
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedYouthId(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              !selectedYouthId
                ? "bg-[#2e8b8b] text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            All Youth
          </button>
          {youthList.map((youth) => (
            <button
              type="button"
              key={youth.id}
              onClick={() => setSelectedYouthId(youth.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                selectedYouthId === youth.id
                  ? "bg-[#2e8b8b] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {youth.first_name} {youth.last_name}
            </button>
          ))}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="today">Latest Day</TabsTrigger>
          <TabsTrigger value="all">All Observations</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4 space-y-3">
          <ObservationGroups groups={byDate} latestOnly />
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-3">
          <ObservationGroups groups={byDate} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function ObservationGroups({
  groups,
  latestOnly = false,
}: {
  groups: Record<string, ObservationRecord[]>;
  latestOnly?: boolean;
}) {
  const entries = Object.entries(groups).sort(([left], [right]) =>
    right.localeCompare(left),
  );
  const visible = latestOnly ? entries.slice(0, 1) : entries;
  if (visible.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No observations recorded.
      </p>
    );
  return visible.map(([date, observations]) => (
    <section key={date}>
      <h2 className="mb-2 text-sm font-semibold text-[#1a3a3a]">{date}</h2>
      <div className="space-y-2">
        {observations.map((observation) => (
          <ObservationCard key={observation.id} observation={observation} />
        ))}
      </div>
    </section>
  ));
}

function ObservationSummary() {
  const { data: summary } = trpc.m15.coordinationSummary.useQuery();
  if (!summary) return null;
  const items = [
    ["Today's Observations", summary.todayObservations],
    ["Attention Requests", summary.pendingClinicalResponses],
    ["Today's Meetings", summary.todaysMeetings],
    ["Open Actions", summary.openActionItems],
    ["Active Escalations", summary.activeEscalations],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#1a3a3a]">{value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ObservationCard({ observation }: { observation: ObservationRecord }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={observation.clinical_concerns ? "border-amber-300" : ""}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              {observation.youth_name}{" "}
              <span className="text-muted-foreground">({observation.mrn})</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {observation.observation_date} · {observation.shift} shift · By{" "}
              {observation.observed_by}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {observation.clinical_concerns && (
              <Badge className="bg-amber-100 text-amber-800">
                Human attention requested
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {expanded ? "▼" : "▶"}
            </span>
          </div>
        </div>
      </button>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {DOMAINS.map((domain) => (
              <div key={domain.storageNotes} className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-[#1a3a3a]">
                  {domain.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {readNullableString(observation, domain.storageNotes) ||
                    "No narrative entered"}
                </div>
              </div>
            ))}
          </div>
          {observation.clinical_concerns && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Staff-requested clinician attention:</strong>{" "}
              {observation.clinical_concerns}
            </div>
          )}
          {observation.clinician_response && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <strong>Clinician response:</strong>{" "}
              {observation.clinician_response}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewObservationForm({ youthList }: { youthList: YouthRecord[] }) {
  const [form, setForm] = useState<ObservationFormState>(blankObservationForm);
  const selectedYouth = youthList.find((youth) => youth.id === form.youthId);
  const utils = trpc.useUtils();
  const createObservation = trpc.m15.createObservation.useMutation({
    onSuccess: () => {
      utils.m15.listObservations.invalidate();
      setForm(blankObservationForm());
    },
  });

  const handleSubmit = () => {
    if (!selectedYouth) return;
    const notes = form.domainNotes.map((value) => value.trim());
    createObservation.mutate({
      youthId: selectedYouth.id,
      youthName: `${selectedYouth.first_name} ${selectedYouth.last_name}`,
      mrn: selectedYouth.mrn,
      observationDate: form.observationDate,
      shift: form.shift,
      domain1Safety: notes[0].length > 0,
      domain1SafetyNotes: notes[0] || undefined,
      domain2Regulation: notes[1].length > 0,
      domain2RegulationNotes: notes[1] || undefined,
      domain3Functioning: notes[2].length > 0,
      domain3FunctioningNotes: notes[2] || undefined,
      domain4Medication: notes[3].length > 0,
      domain4MedicationNotes: notes[3] || undefined,
      domain5Relationships: notes[4].length > 0,
      domain5RelationshipsNotes: notes[4] || undefined,
      domain6Participation: notes[5].length > 0,
      domain6ParticipationNotes: notes[5] || undefined,
      clinicalConcerns: form.clinicalConcerns.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Youth *</Label>
        <Select
          value={form.youthId}
          onValueChange={(youthId) => setForm({ ...form, youthId })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select youth" />
          </SelectTrigger>
          <SelectContent>
            {youthList.map((youth) => (
              <SelectItem key={youth.id} value={youth.id}>
                {youth.first_name} {youth.last_name} ({youth.mrn})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedYouth && (
        <div className="rounded bg-gray-50 p-2 text-xs text-muted-foreground">
          {selectedYouth.first_name} {selectedYouth.last_name} · Age{" "}
          {selectedYouth.age} · Bed:{" "}
          {selectedYouth.bed_assignment ?? "Unassigned"}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={form.observationDate}
            onChange={(event) =>
              setForm({ ...form, observationDate: event.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Shift</Label>
          <Select
            value={form.shift}
            onValueChange={(shift) =>
              setForm({ ...form, shift: shift as ObservationShift })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
      <div className="text-xs font-semibold text-[#1a3a3a]">
        Six-domain narrative
      </div>
      {DOMAINS.map((domain, index) => (
        <div key={domain.storageNotes}>
          <Label className="text-xs">{domain.label}</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            {domain.description}
          </p>
          <Textarea
            value={form.domainNotes[index]}
            onChange={(event) => {
              const domainNotes = [...form.domainNotes];
              domainNotes[index] = event.target.value;
              setForm({ ...form, domainNotes });
            }}
            placeholder={`Document observed ${domain.label.toLowerCase()} behavior...`}
            className="min-h-16 text-xs"
          />
        </div>
      ))}
      <Separator />
      <div>
        <Label className="text-xs">
          Request clinician attention (optional)
        </Label>
        <Textarea
          value={form.clinicalConcerns}
          onChange={(event) =>
            setForm({ ...form, clinicalConcerns: event.target.value })
          }
          placeholder="Describe the observed concern and why a clinician should review it."
        />
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedYouth || createObservation.isPending}
        className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]"
      >
        Submit Narrative Observation
      </Button>
    </div>
  );
}

export default DailyObservationsPage;
