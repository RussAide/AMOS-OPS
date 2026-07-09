import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const AUDIT_AREAS = [
  { key: "area1_identifying_info", label: "Identifying Information", desc: "Demographics, MRN, guardian contacts current" },
  { key: "area2_consent_forms", label: "Consent Forms", desc: "Treatment, release of info, guardian consent on file" },
  { key: "area3_assessment_current", label: "Assessment Currency", desc: "CANS/ANSA within 30 days, LOC current" },
  { key: "area4_treatment_plan", label: "Treatment Plan", desc: "Signed, dated, goals measurable, review dates" },
  { key: "area5_progress_notes", label: "Progress Notes", desc: "Timely, signed, reflect interventions and response" },
  { key: "area6_medication_records", label: "Medication Records", desc: "MAR complete, PRN documented, controlled counts" },
  { key: "area7_safety_plans", label: "Safety Plans", desc: "Current, youth-specific, reviewed after incidents" },
  { key: "area8_incident_reports", label: "Incident Reports", desc: "Complete, debriefed, corrective actions documented" },
  { key: "area9_authorization_billing", label: "Authorization & Billing", desc: "Auth active, exclusions identified, UB-04 clean" },
];

const RESULT_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-700 border-green-300",
  pass_with_notes: "bg-yellow-100 text-yellow-700 border-yellow-300",
  fail: "bg-red-100 text-red-700 border-red-300",
  incomplete: "bg-gray-100 text-gray-500 border-gray-300",
};

export function ChartAuditPage() {
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const { data: audits = [] } = trpc.m21.listAudits.useQuery();
  const selectedAudit = audits.find((a: any) => a.id === selectedAuditId);

  return (
    <>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Chart Audit Tool</h1>
          <p className="text-sm text-muted-foreground mt-1">9-area chart audit with corrective action tracking — SOP Toolkit 8</p>
        </div>
      </div>

      {/* Audit List */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#2e8b8b] uppercase tracking-wider">Recent Audits</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {audits.map((a: any) => (
            <button
              key={a.id}
              onClick={() => setSelectedAuditId(a.id === selectedAuditId ? null : a.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${selectedAuditId === a.id ? "border-[#2e8b8b] ring-1 ring-[#2e8b8b]" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{a.youth_name}</span>
                  <span className="text-xs text-muted-foreground">{a.mrn}</span>
                  <Badge className={`${RESULT_COLORS[a.overall_result] ?? "bg-gray-100"} text-xs`}>{a.overall_result.replace(/_/g, " ")}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{a.audit_date} · {a.auditor_name}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{a.areas_passed}/{a.areas_total} areas passed</div>
            </button>
          ))}
          {audits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No audits found.</p>}
        </CardContent>
      </Card>

      {selectedAudit && <AuditDetail audit={selectedAudit} />}
    </div>
  </>
  );
}

function AuditDetail({ audit: a }: { audit: any }) {
  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${RESULT_COLORS[a.overall_result] ?? "border-gray-300"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{a.youth_name} <span className="text-muted-foreground">({a.mrn})</span></div>
            <div className="text-xs">Audited by {a.auditor_name} on {a.audit_date}</div>
          </div>
          <Badge className={`${RESULT_COLORS[a.overall_result] ?? "bg-gray-100"} text-sm px-3 py-1`}>{a.overall_result.replace(/_/g, " ").toUpperCase()}</Badge>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div className="bg-[#2e8b8b] h-2 rounded-full" style={{ width: `${(a.areas_passed / a.areas_total) * 100}%` }} />
        </div>
        <div className="text-xs text-right mt-0.5">{a.areas_passed}/{a.areas_total} areas passed</div>
      </div>

      {/* 9 Audit Areas */}
      <div className="grid grid-cols-1 gap-2">
        {AUDIT_AREAS.map((area) => {
          const passed = a[area.key] === 1;
          const notes = a[`${area.key.replace("_info", "")}_notes` as keyof typeof a] as string;
          return (
            <Card key={area.key} className={passed ? "border-green-200" : "border-red-200"}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${passed ? "bg-[#2e8b8b] text-white" : "bg-red-500 text-white"}`}>{passed ? "✓" : "✗"}</div>
                    <span className="text-sm font-medium">{area.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{area.desc}</span>
                </div>
                {notes && <div className={`text-xs mt-1 pl-8 ${passed ? "text-green-700" : "text-red-700"}`}>{notes}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Corrective Actions */}
      {a.corrective_actions && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-yellow-800">Corrective Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-yellow-800 whitespace-pre-line">{a.corrective_actions}</div>
            {a.follow_up_date && <div className="text-xs text-yellow-700 mt-2 font-medium">Follow-up due: {a.follow_up_date}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ChartAuditPage;
