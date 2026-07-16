import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const TOOLKITS = [
  {
    num: 1,
    title: "Referral & Service Activation Checklist",
    desc: "10-item checklist for intake completeness: referral form, demographics, insurance, consent, records, legal status, guardian contact, activation date.",
    href: "/intake",
    status: "IMPLEMENTED",
    module: "M13: Intake",
    sopRef: "Part XIV, Toolkit 1",
  },
  {
    num: 2,
    title: "High-Acuity Assessment Worksheet",
    desc: "Structured narrative assessment covering presenting information, history, strengths, needs, observations, and governed clinical-workflow handoff.",
    href: "/intake/assessment",
    status: "NARRATIVE + GOVERNED",
    module: "M13: Assessment",
    sopRef: "Part XIV, Toolkit 2",
  },
  {
    num: 3,
    title: "Level-of-Care Determination Matrix",
    desc: "Program-specific level-of-care guidance with authoritative source, validation, competency, named human review, rationale, and audit controls.",
    href: "/clinical/intelligence-fabric",
    status: "GOVERNED",
    module: "M13: Assessment",
    sopRef: "Part XIV, Toolkit 3",
  },
  {
    num: 4,
    title: "Daily GRO-to-BHC Clinical Observation Summary",
    desc: "6-domain structured observation (Safety, Regulation, Functioning, Medication, Relationships, Participation) with clinical significance routing.",
    href: "/observations",
    status: "IMPLEMENTED",
    module: "M14: Daily Observations",
    sopRef: "Part XIV, Toolkit 4",
  },
  {
    num: 5,
    title: "Weekly Integrated Case Staffing Agenda",
    desc: "7-item agenda for case staffing meetings: overnight report, clinical observations, youth status, activities, safety updates, staffing, action items.",
    href: "/meetings",
    status: "IMPLEMENTED",
    module: "M14: Meetings",
    sopRef: "Part XIV, Toolkit 5",
  },
  {
    num: 6,
    title: "Crisis Debrief Template",
    desc: "9-field post-crisis debrief: event summary, triggers, warning signs, interventions, what worked/didn't, youth perspective, staff perspective, plan adjustments.",
    href: "/crisis",
    status: "IMPLEMENTED",
    module: "M15: Crisis Response",
    sopRef: "Part XIV, Toolkit 6",
  },
  {
    num: 7,
    title: "Authorization Readiness Checklist",
    desc: "10-requirement checklist: clinical docs, current assessment, LOC supported, treatment plan, progress notes, medical necessity, utilization review, guardian consent, UB-04, exclusions.",
    href: "/authorizations",
    status: "IMPLEMENTED",
    module: "M17: Authorizations",
    sopRef: "Part XIV, Toolkit 7",
  },
  {
    num: 8,
    title: "Chart Audit Tool",
    desc: "9-area chart audit: identifying info, consent forms, assessment currency, treatment plan, progress notes, medication records, safety plans, incident reports, authorization/billing.",
    href: "/toolkits/chart-audit",
    status: "IMPLEMENTED",
    module: "M18: Chart Audit",
    sopRef: "Part XIV, Toolkit 8",
  },
  {
    num: 9,
    title: "Governed CANS Profile Experience",
    desc: "Distinct Texas TRR and DFPS CANS 3.0 metadata profiles, validation status, source and version controls, competency gates, and synthetic pathway demonstrations. Legacy automated scoring is quarantined.",
    href: "/toolkits/cans",
    status: "GOVERNED",
    module: "M27: Advanced Tooling",
    sopRef: "Part XIV, Toolkit 9",
  },
];

export function ToolkitHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a3a]">
          Operational Toolkits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All 9 SOP toolkit routes presented as operational or governed
          experiences — SOP Part XIV
        </p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-[#2e8b8b] text-white">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">9/9</div>
            <div className="text-xs opacity-80">Toolkit Routes Governed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#1a3a3a]">6</div>
            <div className="text-xs text-muted-foreground">Milestones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#1a3a3a]">25</div>
            <div className="text-xs text-muted-foreground">Database Tables</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#1a3a3a]">10</div>
            <div className="text-xs text-muted-foreground">Backend Routers</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolkit Cards */}
      <div className="space-y-3">
        {TOOLKITS.map((tk) => (
          <Card
            key={tk.num}
            className="hover:border-[#2e8b8b]/50 transition-all"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#1a3a3a] text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {tk.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{tk.title}</span>
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      {tk.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-[#2e8b8b]">
                      {tk.sopRef}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tk.desc}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <a
                      href={`#${tk.href}`}
                      className="text-[#2e8b8b] font-medium hover:underline"
                    >
                      Open {tk.module} →
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Integration Status */}
      <Card className="bg-[#f0f5f5] border-[#2e8b8b]/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#2e8b8b] uppercase tracking-wider">
            End-to-End Youth Pathway Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              "Referral",
              "Intake",
              "Assessment",
              "Governed Clinical Decision",
              "Admission",
              "Daily Observations",
              "Case Management",
              "Crisis Response",
              "Authorization",
              "Discharge Planning",
            ].map((step, idx) => (
              <span key={step} className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-[#2e8b8b] text-white text-xs font-medium">
                  {step}
                </span>
                {idx < 9 && <span className="text-[#2e8b8b]">→</span>}
              </span>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="text-[#2e8b8b] font-medium">4</span> youth in
              demo data
            </div>
            <div>
              <span className="text-[#2e8b8b] font-medium">3</span> active
              residential
            </div>
            <div>
              <span className="text-[#2e8b8b] font-medium">2</span> crisis
              events tracked
            </div>
            <div>
              <span className="text-[#2e8b8b] font-medium">4</span>{" "}
              authorizations managed
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ToolkitHubPage;
