import { useState } from "react";
import { ArrowRight, BookOpenCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";

interface NarrativeDomain {
  id: string;
  domain_name: string;
  strengths: string | null;
  needs: string | null;
  observations: string | null;
  clinical_notes: string | null;
  intervention_needed: number | boolean;
  intervention_description: string | null;
}

interface AssessmentDetail {
  id: string;
  youth_name: string;
  mrn: string;
  assessment_type: string;
  assessment_date: string;
  completed_by: string;
  status: string;
  presenting_problems: string | null;
  psychiatric_history: string | null;
  trauma_history: string | null;
  substance_use_history: string | null;
  medical_history: string | null;
  family_history: string | null;
  educational_history: string | null;
  domains: NarrativeDomain[];
}

interface IntakeYouth {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  age: number;
  guardian1_name: string;
}

export function AssessmentPage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const { data: rawAssessments = [] } = trpc.m14.listAssessments.useQuery();
  const { data: rawAssessmentDetail } = trpc.m14.getAssessment.useQuery(
    { id: selectedAssessmentId ?? "" },
    { enabled: !!selectedAssessmentId },
  );
  const { data: rawYouthList = [] } = trpc.m13.listYouth.useQuery();
  const assessments = rawAssessments as AssessmentDetail[];
  const assessment = rawAssessmentDetail as AssessmentDetail | null | undefined;
  const youthList = rawYouthList as IntakeYouth[];

  return (
    <main
      className="space-y-6"
      data-testid="m41c-narrative-assessment-workspace"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2e8b8b]">
            Intake documentation
          </p>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">
            Narrative Assessment Workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record presenting information, history, strengths, needs, and
            observations.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">
              + New Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Narrative Assessment</DialogTitle>
            </DialogHeader>
            <NewAssessmentForm youthList={youthList} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold text-emerald-950">
                Governed clinical intelligence
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-emerald-950/75">
                Instrument scoring, risk stratification, recommendations, and
                level-of-care workflows are available only through the Clinical
                Intelligence Fabric with source, version, competency,
                validation, and human-review controls.
              </p>
            </div>
          </div>
          <Link
            to="/clinical/intelligence-fabric"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#245C5A] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Open governed workflow <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
              Assessments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assessments.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedAssessmentId(item.id)}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedAssessmentId === item.id
                    ? "border-[#2e8b8b] bg-[#2e8b8b]/5 ring-1 ring-[#2e8b8b]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">
                    {item.youth_name}{" "}
                    <span className="text-muted-foreground">({item.mrn})</span>
                  </div>
                  <AssessmentStatusBadge status={item.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.assessment_type.replace(/_/g, " ")} ·{" "}
                  {item.assessment_date} · By {item.completed_by}
                </div>
              </button>
            ))}
            {assessments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No assessments found.
              </p>
            )}
          </CardContent>
        </Card>

        {assessment ? (
          <AssessmentNarrative assessment={assessment} />
        ) : (
          <Card className="grid min-h-64 place-items-center">
            <CardContent className="text-center text-sm text-muted-foreground">
              Select an assessment to review its narrative documentation.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function AssessmentNarrative({ assessment }: { assessment: AssessmentDetail }) {
  const historyFields = [
    ["Presenting problems", assessment.presenting_problems],
    ["Psychiatric history", assessment.psychiatric_history],
    ["Trauma history", assessment.trauma_history],
    ["Substance-use history", assessment.substance_use_history],
    ["Medical history", assessment.medical_history],
    ["Family history", assessment.family_history],
    ["Educational history", assessment.educational_history],
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a3a3a] to-[#2a5a5a] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{assessment.youth_name}</h2>
              <p className="mt-1 text-xs text-[#b8d8d4]">
                {assessment.assessment_type.replace(/_/g, " ")} assessment ·{" "}
                {assessment.assessment_date}
              </p>
            </div>
            <AssessmentStatusBadge status={assessment.status} />
          </div>
        </div>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          {historyFields.map(([label, value]) => (
            <NarrativeField key={label} label={label} value={value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <BookOpenCheck
            size={18}
            className="text-[#2e8b8b]"
            aria-hidden="true"
          />
          <CardTitle className="text-sm">Six-domain narrative</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(assessment.domains ?? []).map((domain) => (
            <div
              key={domain.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="font-medium text-[#1a3a3a]">
                {domain.domain_name}
              </div>
              <div className="mt-3 space-y-3">
                <NarrativeField label="Strengths" value={domain.strengths} />
                <NarrativeField label="Needs" value={domain.needs} />
                <NarrativeField
                  label="Observations"
                  value={domain.observations}
                />
                <NarrativeField
                  label="Clinical notes"
                  value={domain.clinical_notes}
                />
                <NarrativeField
                  label="Intervention description"
                  value={domain.intervention_description}
                />
              </div>
            </div>
          ))}
          {(assessment.domains ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No narrative domain data is available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssessmentStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    pending_review: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    superseded: "bg-gray-100 text-gray-500",
  };
  return (
    <Badge className={classes[status] ?? "bg-gray-100"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function NarrativeField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="mt-0.5 text-sm text-slate-700">
        {value?.trim() || "Not documented"}
      </p>
    </div>
  );
}

function NewAssessmentForm({ youthList }: { youthList: IntakeYouth[] }) {
  const updateAssessment = trpc.m14.updateAssessment.useMutation();
  const createAssessment = trpc.m14.createAssessment.useMutation({
    onSuccess: (created) =>
      updateAssessment.mutate({ id: created.id, status: "in_progress" }),
  });
  const [form, setForm] = useState({
    youthId: "",
    assessmentType: "intake",
    assessmentDate: new Date().toISOString().split("T")[0],
    presentingProblems: "",
    psychiatricHistory: "",
    traumaHistory: "",
  });
  const selectedYouth = youthList.find((youth) => youth.id === form.youthId);

  const handleSubmit = () => {
    if (!selectedYouth) return;
    createAssessment.mutate({
      ...form,
      mrn: selectedYouth.mrn,
      youthName: `${selectedYouth.first_name} ${selectedYouth.last_name}`,
      assessmentType: form.assessmentType as Parameters<
        typeof createAssessment.mutate
      >[0]["assessmentType"],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Youth *</Label>
        <Select
          value={form.youthId}
          onValueChange={(value) => setForm({ ...form, youthId: value })}
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
          {selectedYouth.age} · {selectedYouth.guardian1_name}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Assessment type</Label>
          <Select
            value={form.assessmentType}
            onValueChange={(value) =>
              setForm({ ...form, assessmentType: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intake">Intake</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="discharge">Discharge</SelectItem>
              <SelectItem value="incident_driven">Incident-driven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Assessment date</Label>
          <Input
            type="date"
            value={form.assessmentDate}
            onChange={(event) =>
              setForm({ ...form, assessmentDate: event.target.value })
            }
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Presenting problems</Label>
        <Textarea
          value={form.presentingProblems}
          onChange={(event) =>
            setForm({ ...form, presentingProblems: event.target.value })
          }
          rows={3}
        />
      </div>
      <div>
        <Label className="text-xs">Psychiatric history</Label>
        <Textarea
          value={form.psychiatricHistory}
          onChange={(event) =>
            setForm({ ...form, psychiatricHistory: event.target.value })
          }
          rows={2}
        />
      </div>
      <div>
        <Label className="text-xs">Trauma history</Label>
        <Textarea
          value={form.traumaHistory}
          onChange={(event) =>
            setForm({ ...form, traumaHistory: event.target.value })
          }
          rows={2}
        />
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedYouth || createAssessment.isPending}
        className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]"
      >
        Create Narrative Assessment
      </Button>
    </div>
  );
}

export default AssessmentPage;
