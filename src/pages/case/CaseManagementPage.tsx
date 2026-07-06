import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FUNCTIONS = [
  { key: "function1_coordination", label: "Care Coordination", desc: "Coordinate services across providers and systems" },
  { key: "function2_referrals", label: "Referral Management", desc: "Track external referrals and their status" },
  { key: "function3_collaterals", label: "Collateral Contacts", desc: "Log contacts with family, school, court, etc." },
  { key: "function4_barriers", label: "Barrier Tracking", desc: "Identify and resolve barriers to treatment" },
  { key: "function5_monitoring", label: "Progress Monitoring", desc: "Track clinical progress and outcomes" },
  { key: "function6_transition", label: "Transition Planning", desc: "Plan for discharge or level-of-care change" },
];

const STATUS_MAP: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  pending_review: "bg-orange-100 text-orange-700",
  closed: "bg-gray-100 text-gray-500",
  transferred: "bg-blue-100 text-blue-700",
};

export function CaseManagementPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const { data: cases = [] } = trpc.m16.listCases.useQuery();
  const { data: summary } = trpc.m16.caseMgmtSummary.useQuery();
  const { data: youthList = [] } = trpc.m13.listYouth.useQuery();

  const selectedCase = cases.find((c: any) => c.id === selectedCaseId);

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">MHTCM Case Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6-function care management with barrier tracking and progress monitoring — SOP Part VII
          </p>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Active Cases", value: summary.activeCases, color: "text-[#1a3a3a]" },
            { label: "On Hold", value: summary.onHoldCases, color: summary.onHoldCases > 0 ? "text-yellow-600" : "text-gray-400" },
            { label: "Pending Review", value: summary.pendingReview, color: summary.pendingReview > 0 ? "text-orange-600" : "text-gray-400" },
            { label: "Total Cases", value: summary.totalCases, color: "text-[#1a3a3a]" },
            { label: "Overdue Reviews", value: summary.overdueReviews, color: summary.overdueReviews > 0 ? "text-red-600" : "text-green-600" },
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

      {/* Case Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">
            Active Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cases.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id === selectedCaseId ? null : c.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedCaseId === c.id ? "border-[#2e8b8b] bg-[#2e8b8b]/5 ring-1 ring-[#2e8b8b]" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{c.youth_name} <span className="text-muted-foreground">({c.mrn})</span></div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${STATUS_MAP[c.status] ?? "bg-gray-100"} text-xs`}>{c.status}</Badge>
                    {c.case_manager_name && <span className="text-xs text-muted-foreground">{c.case_manager_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Last review: {c.last_review_date ?? "Not reviewed"}</span>
                  {c.next_review_date && <><span>·</span><span>Next: {c.next_review_date}</span></>}
                </div>
              </button>
            ))}
            {cases.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No cases found.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Case Detail */}
      {selectedCase && <CaseDetail caseData={selectedCase} />}
    </div>
  </>
  );
}

function CaseDetail({ caseData: c }: { caseData: any }) {
  const functionsCompleted = FUNCTIONS.filter((f, idx) => c[`function${idx + 1}_${f.key.split("_")[1]}` as keyof typeof c] === 1).length;

  let referrals: any[] = []; try { referrals = JSON.parse(c.function2_referrals_json ?? "[]"); } catch { /* */ }
  let collaterals: any[] = []; try { collaterals = JSON.parse(c.function3_collaterals_json ?? "[]"); } catch { /* */ }
  let barriers: any[] = []; try { barriers = JSON.parse(c.function4_barriers_json ?? "[]"); } catch { /* */ }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-[#1a3a3a] to-[#2a5a5a] text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{c.youth_name}</div>
            <div className="text-xs text-[#a0c4c0]">MRN: {c.mrn} · Case Manager: {c.case_manager_name ?? "Unassigned"}</div>
          </div>
          <div className="text-right">
            <Badge className="bg-white/20 text-white">{c.status}</Badge>
            <div className="text-xs text-[#a0c4c0] mt-1">{functionsCompleted}/6 functions active</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 6 Functions */}
        {FUNCTIONS.map((f, idx) => {
          const isActive = c[`function${idx + 1}_${f.key.split("_")[1]}` as keyof typeof c] === 1;
          const notes = c[`function${idx + 1}_${f.key.split("_")[1]}_notes` as keyof typeof c] as string;
          return (
            <Card key={f.key} className={isActive ? "border-[#2e8b8b]/30" : "border-gray-200 opacity-70"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{f.label}</CardTitle>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isActive ? "bg-[#2e8b8b] text-white" : "bg-gray-200"}`}>
                    {isActive ? "✓" : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </CardHeader>
              {isActive && notes && (
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground">{notes}</div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Referrals */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">External Referrals</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {referrals.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded border border-gray-200">
                  <div>
                    <div className="text-sm font-medium">{r.provider}</div>
                    <div className="text-xs text-muted-foreground">{r.type} · {r.date}</div>
                  </div>
                  <Badge className={r.status === "Active" ? "bg-green-100 text-green-700" : r.status === "Pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collaterals */}
      {collaterals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Collateral Contacts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {collaterals.map((contact: any, idx: number) => (
                <div key={idx} className="p-2 rounded border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{contact.contact}</div>
                    <span className="text-xs text-muted-foreground">{contact.relationship}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{contact.date}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{contact.notes}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barriers */}
      {barriers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Barriers & Resolutions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {barriers.map((b: any, idx: number) => (
                <div key={idx} className={`p-2 rounded border ${b.impact === "High" ? "border-red-300 bg-red-50" : b.impact === "Moderate" ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{b.barrier}</div>
                    <Badge className={b.impact === "High" ? "bg-red-100 text-red-700" : b.impact === "Moderate" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}>
                      {b.impact}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{b.resolution}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CaseManagementPage;
