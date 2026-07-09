import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ShiftHandoffPage() {
  const { data: shifts = [] } = trpc.m18.listShifts.useQuery();
  const { data: summary } = trpc.m18.residentialSummary.useQuery();

  const inProgress = shifts.find((s: any) => s.status === "in_progress");
  const completed = shifts.filter((s: any) => s.status === "completed");
  const scheduled = shifts.filter((s: any) => s.status === "scheduled");

  return (
    <>

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Shift Handoffs</h1>
          <p className="text-sm text-muted-foreground mt-1">Shift assignments, coverage, and handoff notes with alerts</p>
        </div>
      </div>

      {summary && summary.pendingHandoffs > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800 font-medium">
              <span>⚠</span> {summary.pendingHandoffs} pending handoff{summary.pendingHandoffs > 1 ? "s" : ""} requiring completion
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Shift */}
      {inProgress && (
        <Card className="border-[#2e8b8b]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg capitalize">{inProgress.shift_type} Shift — IN PROGRESS</CardTitle>
              <Badge className="bg-[#2e8b8b] text-white">{inProgress.start_time} – {inProgress.end_time}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-muted-foreground">RCS Lead</span><div className="font-medium">{inProgress.rcs_lead_name ?? "TBD"}</div></div>
              <div><span className="text-xs text-muted-foreground">Nurse</span><div className="font-medium">{inProgress.nurse_name ?? "TBD"}</div></div>
              <div><span className="text-xs text-muted-foreground">Clinician</span><div className="font-medium">{inProgress.clinician_on_call ?? "TBD"}</div></div>
              <div><span className="text-xs text-muted-foreground">Coverage</span><Badge className={inProgress.coverage_status === "full" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{inProgress.coverage_status}</Badge></div>
            </div>
            {inProgress.rcs_staff_ids_json && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">RCS Staff</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(JSON.parse(inProgress.rcs_staff_ids_json) as any[]).map((s: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{s.name}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {inProgress.coverage_notes && (
              <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">{inProgress.coverage_notes}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed Shifts */}
      {completed.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Completed</div>
          {completed.map((s: any) => (
            <Card key={s.id} className="mb-2 opacity-70">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">{s.shift_type}</span>
                    <span className="text-xs text-muted-foreground">{s.start_time} – {s.end_time}</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Completed</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Lead: {s.rcs_lead_name} · Nurse: {s.nurse_name}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scheduled Shifts */}
      {scheduled.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Scheduled</div>
          {scheduled.map((s: any) => (
            <Card key={s.id} className="mb-2">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">{s.shift_type}</span>
                    <span className="text-xs text-muted-foreground">{s.start_time} – {s.end_time}</span>
                  </div>
                  <Badge variant="outline">Scheduled</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Lead: {s.rcs_lead_name ?? "TBD"} · Nurse: {s.nurse_name ?? "TBD"} · Clinician: {s.clinician_on_call ?? "TBD"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Handoff Template */}
      <Card className="bg-[#f0f5f5] border-[#2e8b8b]/30">
        <CardHeader><CardTitle className="text-sm font-semibold text-[#2e8b8b]">Handoff Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {[
              "Youth status review (all residents)",
              "Medication administration status",
              "Behavioral observations & concerns",
              "Appointment reminders (next 24h)",
              "Family contact follow-ups",
              "Safety alerts & precautions",
              "Pending incident reports",
              "Maintenance / facility issues",
              "Staffing coverage for next shift",
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white">
                <div className="w-5 h-5 rounded border-2 border-gray-300 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  </>
  );
}

export default ShiftHandoffPage;
