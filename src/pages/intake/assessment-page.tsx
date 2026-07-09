import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DOMAIN_NAMES = [
  "Behavioral / Emotional Functioning",
  "Cognitive / Developmental Functioning",
  "Social / Relational Functioning",
  "Family / Caregiver Functioning",
  "Safety / Risk Behaviors",
  "Physical Health / Medical",
];

const RISK_LEVELS = ["none", "low", "moderate", "high", "imminent"] as const;

export function AssessmentPage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { data: assessments = [] } = trpc.m14.listAssessments.useQuery();
  const { data: assessmentDetail } = trpc.m14.getAssessment.useQuery(
    { id: selectedAssessmentId ?? "" },
    { enabled: !!selectedAssessmentId }
  );
  const { data: youthList = [] } = trpc.m13.listYouth.useQuery();

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Comprehensive Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6-domain assessment with CANS/ANSA scoring and LOC determination — SOP Part IV
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">+ New Assessment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Assessment</DialogTitle>
            </DialogHeader>
            <NewAssessmentForm youthList={youthList} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Assessment List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            Assessments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {assessments.map((a: any) => (
              <button
                key={a.id}
                onClick={() => setSelectedAssessmentId(a.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedAssessmentId === a.id
                    ? "border-[#2e8b8b] bg-[#2e8b8b]/5 ring-1 ring-[#2e8b8b]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{a.youth_name} <span className="text-muted-foreground">({a.mrn})</span></div>
                  <AssessmentStatusBadge status={a.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{a.assessment_type} assessment</span>
                  <span>·</span>
                  <span>{a.assessment_date}</span>
                  <span>·</span>
                  <span>By {a.completed_by}</span>
                  {a.cans_completed === 1 && (
                    <>
                      <span>·</span>
                      <span className="text-[#2e8b8b] font-medium">CANS: {a.cans_total_score}</span>
                    </>
                  )}
                  {a.loc_determined === 1 && (
                    <>
                      <span>·</span>
                      <LOCBadge level={a.loc_level} />
                    </>
                  )}
                </div>
              </button>
            ))}
            {assessments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No assessments found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assessment Detail */}
      {assessmentDetail && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="domains">6-Domain Assessment</TabsTrigger>
            <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
            <TabsTrigger value="loc">LOC Determination</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <AssessmentOverview assessment={assessmentDetail} />
          </TabsContent>

          <TabsContent value="domains" className="space-y-4 mt-4">
            <DomainAssessment domains={assessmentDetail.domains ?? []} />
          </TabsContent>

          <TabsContent value="risk" className="space-y-4 mt-4">
            <RiskAssessment assessment={assessmentDetail} />
          </TabsContent>

          <TabsContent value="loc" className="space-y-4 mt-4">
            <LOCDetermination assessment={assessmentDetail} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  </>
  );
}

function AssessmentOverview({ assessment }: { assessment: any }) {
  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-[#1a3a3a] to-[#2a5a5a] text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{assessment.youth_name}</div>
            <div className="text-xs text-[#a0c4c0]">{assessment.assessment_type} assessment · {assessment.assessment_date}</div>
          </div>
          <div className="text-right">
            <AssessmentStatusBadge status={assessment.status} />
            {assessment.loc_determined === 1 && <div className="mt-1"><LOCBadge level={assessment.loc_level} /></div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Presenting Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {assessment.presenting_problems && <Field label="Presenting Problems" value={assessment.presenting_problems} />}
            {assessment.psychiatric_history && <Field label="Psychiatric History" value={assessment.psychiatric_history} />}
            {assessment.trauma_history && <Field label="Trauma History" value={assessment.trauma_history} />}
            {assessment.substance_use_history && <Field label="Substance Use History" value={assessment.substance_use_history} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Background</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {assessment.medical_history && <Field label="Medical History" value={assessment.medical_history} />}
            {assessment.family_history && <Field label="Family History" value={assessment.family_history} />}
            {assessment.educational_history && <Field label="Educational History" value={assessment.educational_history} />}
          </CardContent>
        </Card>
      </div>

      {assessment.cans_completed === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">CANS/ANSA Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#1a3a3a]">{assessment.cans_total_score}</div>
                <div className="text-xs text-muted-foreground">Total Score</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div>
                <div className="text-sm font-medium">Risk Level</div>
                <Badge className={
                  assessment.cans_risk_level === "low" ? "bg-green-100 text-green-800" :
                  assessment.cans_risk_level === "moderate" ? "bg-yellow-100 text-yellow-800" :
                  assessment.cans_risk_level === "high" ? "bg-orange-100 text-orange-800" :
                  "bg-red-100 text-red-800"
                }>
                  {assessment.cans_risk_level}
                </Badge>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div>
                <div className="text-sm font-medium">Safety Plan</div>
                <Badge className={assessment.safety_plan_completed === 1 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                  {assessment.safety_plan_completed === 1 ? "Completed" : "Required"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DomainAssessment({ domains }: { domains: any[] }) {
  const [expandedDomain, setExpandedDomain] = useState<number | null>(null);

  if (!domains || domains.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">No domain data available.</Card>;
  }

  return (
    <div className="space-y-3">
      {domains.map((domain: any, idx: number) => {
        const isExpanded = expandedDomain === idx;
        const score = domain.score;
        const scoreColor = score === 0 ? "bg-green-500" : score === 1 ? "bg-yellow-500" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-red-500" : "bg-gray-300";

        return (
          <Card key={domain.id} className={isExpanded ? "border-[#2e8b8b]/50" : ""}>
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedDomain(isExpanded ? null : idx)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${scoreColor}`}>
                    {score ?? "-"}
                  </div>
                  <div>
                    <div className="font-medium text-sm">Domain {idx + 1}: {domain.domain_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {domain.score_label ? domain.score_label.replace(/_/g, " ") : "Not scored"}
                      {domain.intervention_needed === 1 && " · Intervention needed"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {isExpanded ? "▼" : "▶"}
                </div>
              </div>
            </div>

            {isExpanded && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
                  {domain.strengths && <Field label="Strengths" value={domain.strengths} />}
                  {domain.needs && <Field label="Needs" value={domain.needs} />}
                  {domain.observations && <Field label="Observations" value={domain.observations} />}
                  {domain.clinical_notes && <Field label="Clinical Notes" value={domain.clinical_notes} />}
                  {domain.intervention_description && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-[#2e8b8b]">Intervention</Label>
                      <div className="text-muted-foreground">{domain.intervention_description}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function RiskAssessment({ assessment }: { assessment: any }) {
  const risks = [
    { key: "risk_suicide", label: "Suicide Risk", value: assessment.risk_suicide },
    { key: "risk_self_harm", label: "Self-Harm Risk", value: assessment.risk_self_harm },
    { key: "risk_aggression", label: "Aggression Risk", value: assessment.risk_aggression },
    { key: "risk_elopement", label: "Elopement Risk", value: assessment.risk_elopement },
    { key: "risk_substance_use", label: "Substance Use Risk", value: assessment.risk_substance_use },
    { key: "risk_vulnerability", label: "Vulnerability / Exploitation", value: assessment.risk_vulnerability },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Individual Risk Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {risks.map((risk) => (
              <div key={risk.key} className={`p-3 rounded-lg border ${
                risk.value === "imminent" || risk.value === "high" ? "border-red-300 bg-red-50" :
                risk.value === "moderate" ? "border-yellow-300 bg-yellow-50" :
                "border-gray-200"
              }`}>
                <div className="text-xs text-muted-foreground">{risk.label}</div>
                <div className={`text-sm font-semibold capitalize ${
                  risk.value === "imminent" ? "text-red-700" :
                  risk.value === "high" ? "text-red-600" :
                  risk.value === "moderate" ? "text-yellow-700" :
                  risk.value === "low" ? "text-green-600" :
                  "text-gray-500"
                }`}>
                  {risk.value?.replace(/_/g, " ") ?? "Not assessed"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overall Risk Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold ${
              assessment.overall_risk_level === "critical" ? "text-red-700" :
              assessment.overall_risk_level === "high" ? "text-red-600" :
              assessment.overall_risk_level === "moderate" ? "text-yellow-600" :
              "text-green-600"
            }`}>
              {assessment.overall_risk_level?.toUpperCase() ?? "NOT ASSESSED"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Safety Plan:</span>
              <Badge className={assessment.safety_plan_completed === 1 ? "bg-green-100 text-green-800" : assessment.safety_plan_required === 1 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100"}>
                {assessment.safety_plan_completed === 1 ? "Completed" : assessment.safety_plan_required === 1 ? "Required" : "Not needed"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LOCDetermination({ assessment }: { assessment: any }) {
  if (assessment.loc_determined !== 1) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Level of Care has not been determined for this assessment.</p>
        <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">Determine LOC</Button>
      </Card>
    );
  }

  let matrix: any = {};
  try { matrix = JSON.parse(assessment.loc_decision_matrix_json ?? "{}"); } catch { /* ignore */ }

  return (
    <div className="space-y-4">
      <Card className="border-[#2e8b8b]/30">
        <CardHeader>
          <CardTitle className="text-sm">Level of Care Determination</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <LOCBadge level={assessment.loc_level} large />
            <div>
              <div className="text-sm font-medium">Clinical Rationale</div>
              <div className="text-sm text-muted-foreground max-w-xl">{assessment.loc_clinical_rationale}</div>
            </div>
          </div>
          {assessment.loc_approved_by && (
            <div className="mt-3 text-xs text-muted-foreground">
              Approved by {assessment.loc_approved_by} on {assessment.loc_approved_at}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Decision Matrix (3 Levels x 4 Areas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "safetyRisk", label: "Safety Risk" },
              { key: "clinicalComplexity", label: "Clinical Complexity" },
              { key: "functionalImpairment", label: "Functional Impairment" },
              { key: "familySupport", label: "Family Support" },
            ].map((area) => {
              const val = matrix[area.key] as string;
              return (
                <div key={area.key} className={`p-3 rounded-lg border text-center ${
                  val === "high" ? "border-red-300 bg-red-50" :
                  val === "moderate" ? "border-yellow-300 bg-yellow-50" :
                  val === "low" ? "border-green-300 bg-green-50" :
                  "border-gray-200"
                }`}>
                  <div className="text-xs text-muted-foreground">{area.label}</div>
                  <div className={`text-sm font-semibold capitalize ${
                    val === "high" ? "text-red-700" :
                    val === "moderate" ? "text-yellow-700" :
                    "text-green-700"
                  }`}>{val ?? "—"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LOCBadge({ level, large }: { level: string; large?: boolean }) {
  const labels: Record<string, string> = {
    loc_1_high_acuity: "LOC 1 — High Acuity (Residential)",
    loc_2_moderate_acuity: "LOC 2 — Moderate Acuity (Day Treatment)",
    loc_3_low_acuity: "LOC 3 — Low Acuity (Outpatient)",
    not_determined: "Not Determined",
  };
  return (
    <Badge className={`bg-[#1a3a3a] text-white ${large ? "text-sm px-3 py-1" : ""}`}>
      {labels[level] ?? level}
    </Badge>
  );
}

function AssessmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    pending_review: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    superseded: "bg-gray-100 text-gray-500",
  };
  return <Badge className={map[status] ?? "bg-gray-100"}>{status.replace(/_/g, " ")}</Badge>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function NewAssessmentForm({ youthList }: { youthList: any[] }) {
  const [form, setForm] = useState({
    youthId: "", assessmentType: "intake" as string, assessmentDate: new Date().toISOString().split("T")[0],
    presentingProblems: "", psychiatricHistory: "", traumaHistory: "",
  });

  const selectedYouth = youthList.find((y: any) => y.id === form.youthId);

  const handleSubmit = () => {
    trpc.m14.createAssessment.useMutation().mutate({ ...form, status: "in_progress" } as any);
  };

  return (
    <>

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
          {selectedYouth.first_name} {selectedYouth.last_name} · Age {selectedYouth.age} · {selectedYouth.guardian1_name}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Assessment Type</Label>
          <Select value={form.assessmentType} onValueChange={v => setForm({ ...form, assessmentType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="intake">Intake</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="discharge">Discharge</SelectItem>
              <SelectItem value="incident_driven">Incident-Driven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Assessment Date</Label>
          <Input type="date" value={form.assessmentDate} onChange={e => setForm({ ...form, assessmentDate: e.target.value })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Presenting Problems</Label>
        <Textarea value={form.presentingProblems} onChange={e => setForm({ ...form, presentingProblems: e.target.value })} rows={3} />
      </div>
      <div>
        <Label className="text-xs">Psychiatric History</Label>
        <Textarea value={form.psychiatricHistory} onChange={e => setForm({ ...form, psychiatricHistory: e.target.value })} rows={2} />
      </div>
      <div>
        <Label className="text-xs">Trauma History</Label>
        <Textarea value={form.traumaHistory} onChange={e => setForm({ ...form, traumaHistory: e.target.value })} rows={2} />
      </div>
      <Button onClick={handleSubmit} className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]">
        Create Assessment
      </Button>
    </div>
    </>
  );
}

export default AssessmentPage;
