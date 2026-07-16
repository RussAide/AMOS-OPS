import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

const STAGE_COLORS: Record<string, string> = {
  readiness: "bg-yellow-100 text-yellow-700",
  submission: "bg-blue-100 text-blue-700",
  tracking: "bg-green-100 text-green-700",
  reauthorization: "bg-orange-100 text-orange-700",
  retrospective: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  appealed: "bg-orange-100 text-orange-700",
  expired: "bg-gray-100 text-gray-500",
  closed: "bg-gray-100 text-gray-500",
};

const READINESS_ITEMS = [
  { key: "readiness_clinical_docs", label: "Clinical documentation complete" },
  { key: "readiness_assessment_current", label: "Assessment current (< 30 days)" },
  { key: "readiness_loc_supported", label: "LOC determination clinically supported" },
  { key: "readiness_treatment_plan", label: "Treatment plan signed and dated" },
  { key: "readiness_progress_notes", label: "Progress notes current" },
  { key: "readiness_medical_necessity", label: "Medical necessity documented" },
  { key: "readiness_utilization_review", label: "Utilization review completed" },
  { key: "readiness_guardian_consent", label: "Guardian consent on file" },
  { key: "readiness_ub04_clean", label: "UB-04 claim clean" },
  { key: "readiness_excluded_services", label: "Excluded services identified" },
] as const;

type AuthorizationRecord = inferRouterOutputs<AppRouter>["m20"]["listAuthorizations"][number];

export function AuthorizationPage() {
  const [selectedAuthId, setSelectedAuthId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const { data: auths = [] } = trpc.m20.listAuthorizations.useQuery();
  const { data: summary } = trpc.m20.authSummary.useQuery();

  const activeAuths = auths.filter((a) => a.status !== "closed" && a.status !== "expired");
  const closedAuths = auths.filter((a) => a.status === "closed" || a.status === "expired");
  const selectedAuth = auths.find((a) => a.id === selectedAuthId);

  return (
    <>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Authorization Lifecycle</h1>
          <p className="text-sm text-muted-foreground mt-1">5-stage authorization workflow with readiness tracking — SOP Part XI, Toolkit 7</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-2">
          {[
            { label: "Total", value: summary.total, color: "text-[#1a3a3a]" },
            { label: "Pending", value: summary.pending, color: "text-yellow-600" },
            { label: "Approved", value: summary.approved, color: "text-green-600" },
            { label: "Denied", value: summary.denied, color: "text-red-600" },
            { label: "Appealed", value: summary.appealed, color: "text-orange-600" },
            { label: "Reauth O/D", value: summary.reauthOverdue, color: summary.reauthOverdue > 0 ? "text-red-600" : "text-gray-400" },
            { label: "Expiring", value: summary.upcomingExpiry, color: summary.upcomingExpiry > 0 ? "text-orange-600" : "text-gray-400" },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="all">All ({auths.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeAuths.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedAuths.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-2">
          {auths.map((a) => <AuthCard key={a.id} auth={a} selected={selectedAuthId === a.id} onClick={() => setSelectedAuthId(a.id === selectedAuthId ? null : a.id)} />)}
        </TabsContent>
        <TabsContent value="active" className="mt-4 space-y-2">
          {activeAuths.map((a) => <AuthCard key={a.id} auth={a} selected={selectedAuthId === a.id} onClick={() => setSelectedAuthId(a.id === selectedAuthId ? null : a.id)} />)}
        </TabsContent>
        <TabsContent value="closed" className="mt-4 space-y-2">
          {closedAuths.map((a) => <AuthCard key={a.id} auth={a} selected={selectedAuthId === a.id} onClick={() => setSelectedAuthId(a.id === selectedAuthId ? null : a.id)} />)}
        </TabsContent>
      </Tabs>

      {selectedAuth && <AuthDetail auth={selectedAuth} />}
    </div>
  </>
  );
}

function AuthCard({ auth: a, selected, onClick }: { auth: AuthorizationRecord; selected: boolean; onClick: () => void }) {
  const readinessCount = READINESS_ITEMS.filter(item => a[item.key] === 1).length;
  return (
    <Card className={`cursor-pointer ${selected ? "border-[#2e8b8b] ring-1 ring-[#2e8b8b]" : a.status === "appealed" ? "border-orange-300" : a.days_until_expiration && a.days_until_expiration <= 14 ? "border-yellow-300" : ""}`} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${STAGE_COLORS[a.stage] ?? "bg-gray-100"} text-xs capitalize`}>{a.stage}</Badge>
            <span className="text-sm font-medium">{a.youth_name}</span>
            <span className="text-xs text-muted-foreground">{a.mrn}</span>
          </div>
          <Badge className={`${STATUS_COLORS[a.status] ?? "bg-gray-100"} text-xs capitalize`}>{a.status}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{a.payer_name}</span>
          {a.authorization_number && <><span>·</span><span className="text-[#2e8b8b]">{a.authorization_number}</span></>}
          {a.approved_units && <><span>·</span><span>{a.approved_units} units</span></>}
          {a.days_until_expiration !== null && <><span>·</span><span className={a.days_until_expiration <= 14 ? "text-orange-600 font-medium" : ""}>Exp: {a.days_until_expiration}d</span></>}
          {a.stage === "readiness" && <><span>·</span><span>{readinessCount}/10 ready</span></>}
        </div>
      </CardContent>
    </Card>
  );
}

function AuthDetail({ auth: a }: { auth: AuthorizationRecord }) {
  const readinessCount = READINESS_ITEMS.filter(item => a[item.key] === 1).length;
  const allReady = readinessCount === 10;

  return (
    <div className="space-y-4">
      {/* Stage Progress */}
      <Card className="border-[#2e8b8b]/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#2e8b8b]">5-Stage Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {["readiness", "submission", "tracking", "reauthorization", "retrospective"].map((stage, idx) => {
              const isCurrent = a.stage === stage;
              const isPast = ["readiness", "submission", "tracking", "reauthorization", "retrospective"].indexOf(a.stage) > idx;
              return (
                <div key={stage} className="flex-1 flex items-center">
                  <div className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium capitalize ${
                    isPast ? "bg-[#2e8b8b] text-white" : isCurrent ? "bg-[#1a3a3a] text-white ring-2 ring-[#2e8b8b]" : "bg-gray-200 text-gray-500"
                  }`}>{stage.replace("retrospective", "retro")}</div>
                  {idx < 4 && <div className="w-2" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Readiness Checklist (Toolkit 7) */}
      {a.stage === "readiness" || a.readiness_met_at ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Readiness Checklist (Toolkit 7)</CardTitle>
              <div className="text-sm font-bold text-[#1a3a3a]">{readinessCount}/10</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-[#2e8b8b] h-2 rounded-full" style={{ width: `${readinessCount * 10}%` }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {READINESS_ITEMS.map((item) => {
              const checked = a[item.key] === 1;
              return (
                <div key={item.key} className={`flex items-center gap-2 p-1.5 rounded ${checked ? "text-green-700" : "text-gray-500"}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-xs ${checked ? "bg-[#2e8b8b] text-white" : "bg-gray-200"}`}>{checked ? "✓" : ""}</div>
                  <span className={`text-sm ${checked ? "line-through" : ""}`}>{item.label}</span>
                </div>
              );
            })}
            {allReady && <div className="text-sm text-green-700 text-center font-medium mt-2">All readiness criteria met — ready for submission</div>}
          </CardContent>
        </Card>
      ) : null}

      {/* Approval Details */}
      {a.authorization_number && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Authorization Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-xs text-muted-foreground">Auth #</span><div className="font-medium text-[#2e8b8b]">{a.authorization_number}</div></div>
            <div><span className="text-xs text-muted-foreground">Units</span><div>{a.approved_units}</div></div>
            <div><span className="text-xs text-muted-foreground">From</span><div>{a.approved_from_date}</div></div>
            <div><span className="text-xs text-muted-foreground">To</span><div>{a.approved_to_date}</div></div>
            <div><span className="text-xs text-muted-foreground">Level</span><div>{a.approved_level_of_care}</div></div>
            {a.days_until_expiration !== null && (
              <div><span className="text-xs text-muted-foreground">Days Left</span><div className={a.days_until_expiration <= 14 ? "text-red-600 font-bold" : ""}>{a.days_until_expiration}</div></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Denial / Appeal */}
      {a.denial_reason && (
        <Card className="border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-red-700">Denial & Appeal</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{a.denial_reason}</div>
            {a.appeal_date && (
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-orange-100 text-orange-700">Appealed {a.appeal_date}</Badge>
                <span className="text-muted-foreground">Status: {a.appeal_status}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reauthorization */}
      {a.reauth_due_date && (
        <Card className={a.reauth_status === "overdue" ? "border-red-200" : a.reauth_status === "upcoming" ? "border-yellow-200" : "border-gray-200"}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Reauthorization</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3 text-sm">
            <div><span className="text-xs text-muted-foreground">Due</span><div className={a.reauth_status === "overdue" ? "text-red-600 font-bold" : ""}>{a.reauth_due_date}</div></div>
            <Badge className={a.reauth_status === "overdue" ? "bg-red-100 text-red-700" : a.reauth_status === "upcoming" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}>{a.reauth_status}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Submission */}
      {a.submission_date && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Submission</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-xs text-muted-foreground">Date</span><div>{a.submission_date}</div></div>
            <div><span className="text-xs text-muted-foreground">By</span><div>{a.submitted_by}</div></div>
            <div><span className="text-xs text-muted-foreground">Method</span><div className="capitalize">{a.submission_method}</div></div>
            {a.submission_reference && <div className="md:col-span-3"><span className="text-xs text-muted-foreground">Reference</span><div className="text-[#2e8b8b]">{a.submission_reference}</div></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AuthorizationPage;
