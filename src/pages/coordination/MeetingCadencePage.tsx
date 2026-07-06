import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  daily_huddle: { label: "Daily Huddle", color: "bg-blue-100 text-blue-700" },
  case_staffing: { label: "Case Staffing", color: "bg-purple-100 text-purple-700" },
  treatment_plan_review: { label: "Treatment Plan Review", color: "bg-green-100 text-green-700" },
  family_conference: { label: "Family Conference", color: "bg-orange-100 text-orange-700" },
};

const STATUS_MAP: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
};

const ACTION_STATUS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export function MeetingCadencePage() {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("meetings");
  const { data: meetings = [] } = trpc.m15.listMeetings.useQuery();
  const { data: meetingDetail } = trpc.m15.getMeeting.useQuery(
    { id: selectedMeetingId ?? "" },
    { enabled: !!selectedMeetingId }
  );

  const upcomingMeetings = meetings.filter((m: any) => m.status === "scheduled");
  const completedMeetings = meetings.filter((m: any) => m.status === "completed");

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Meeting Cadence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            4 meeting types with agendas and action item tracking — SOP Part VIII, Toolkit 5
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#2e8b8b] hover:bg-[#1a5a5a]">+ Schedule Meeting</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Schedule New Meeting</DialogTitle></DialogHeader>
            <NewMeetingForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Meeting Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(MEETING_TYPES).map(([key, info]) => {
          const count = meetings.filter((m: any) => m.meeting_type === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${info.color.split(" ")[1]}`}>{count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{info.label}s</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="actions">Action Items</TabsTrigger>
          <TabsTrigger value="huddle">Daily Huddle Template</TabsTrigger>
        </TabsList>

        <TabsContent value="meetings" className="space-y-4 mt-4">
          {/* Upcoming */}
          {upcomingMeetings.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-[#1a3a3a] mb-2">Upcoming</div>
              {upcomingMeetings.map((m: any) => (
                <MeetingRow key={m.id} meeting={m} selected={selectedMeetingId === m.id} onClick={() => setSelectedMeetingId(m.id === selectedMeetingId ? null : m.id)} />
              ))}
            </div>
          )}

          {/* Completed */}
          {completedMeetings.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Completed</div>
              {completedMeetings.map((m: any) => (
                <MeetingRow key={m.id} meeting={m} selected={selectedMeetingId === m.id} onClick={() => setSelectedMeetingId(m.id === selectedMeetingId ? null : m.id)} />
              ))}
            </div>
          )}

          {meetings.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No meetings scheduled.</p>}

          {/* Meeting Detail */}
          {meetingDetail && <MeetingDetailCard meeting={meetingDetail} />}
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <ActionItemsList />
        </TabsContent>

        <TabsContent value="huddle" className="mt-4">
          <DailyHuddleTemplate />
        </TabsContent>
      </Tabs>
    </div>
  </>
  );
}

function MeetingRow({ meeting: m, selected, onClick }: { meeting: any; selected: boolean; onClick: () => void }) {
  const typeInfo = MEETING_TYPES[m.meeting_type] ?? { label: m.meeting_type, color: "bg-gray-100" };
  let attendees: any[] = [];
  try { attendees = JSON.parse(m.attendees_json ?? "[]"); } catch { /* ignore */ }

  return (
    <Card
      className={`mb-2 cursor-pointer transition-all ${selected ? "border-[#2e8b8b] ring-1 ring-[#2e8b8b]" : "hover:border-gray-300"}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
            <span className="text-sm font-medium">{m.title}</span>
          </div>
          <Badge className={`${STATUS_MAP[m.status] ?? "bg-gray-100"} text-xs`}>{m.status}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>{m.scheduled_date} {m.scheduled_time && `at ${m.scheduled_time}`}</span>
          <span>·</span>
          <span>{m.duration_minutes} min</span>
          <span>·</span>
          <span>Facilitator: {m.facilitator_name ?? "TBD"}</span>
          {attendees.length > 0 && <span>·</span>}
          {attendees.length > 0 && <span>{attendees.length} attendees</span>}
          {m.follow_up_required === 1 && (
            <>
              <span>·</span>
              <span className="text-orange-600 font-medium">Follow-up required</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingDetailCard({ meeting: m }: { meeting: any }) {
  let attendees: any[] = [];
  let agenda: any[] = [];
  try { attendees = JSON.parse(m.attendees_json ?? "[]"); } catch { /* ignore */ }
  try { agenda = JSON.parse(m.agenda_json ?? "[]"); } catch { /* ignore */ }

  return (
    <Card className="border-[#2e8b8b]/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{m.title}</CardTitle>
          <Badge className={`${STATUS_MAP[m.status] ?? "bg-gray-100"}`}>{m.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><Label className="text-xs text-muted-foreground">Date</Label><div>{m.scheduled_date}</div></div>
          <div><Label className="text-xs text-muted-foreground">Time</Label><div>{m.scheduled_time ?? "TBD"}</div></div>
          <div><Label className="text-xs text-muted-foreground">Duration</Label><div>{m.duration_minutes} min</div></div>
          <div><Label className="text-xs text-muted-foreground">Facilitator</Label><div>{m.facilitator_name ?? "TBD"}</div></div>
        </div>

        <Separator />

        {agenda.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Agenda</Label>
            <ol className="mt-1 space-y-1">
              {agenda.map((item: string, idx: number) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-[#2e8b8b] font-bold shrink-0">{idx + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        )}

        {attendees.length > 0 && (
          <>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Attendees</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {attendees.map((a: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {a.name} <span className="text-muted-foreground">({a.role})</span>
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {m.notes && (
          <>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <div className="text-sm text-muted-foreground mt-1">{m.notes}</div>
            </div>
          </>
        )}

        {/* Action Items */}
        {m.actionItems && m.actionItems.length > 0 && (
          <>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Action Items ({m.actionItems.length})</Label>
              <div className="space-y-2 mt-2">
                {m.actionItems.map((ai: any) => (
                  <div key={ai.id} className={`flex items-center justify-between p-2 rounded border ${
                    ai.status === "overdue" ? "border-red-300 bg-red-50" : ai.status === "completed" ? "border-green-300 bg-green-50" : "border-gray-200"
                  }`}>
                    <div className="flex-1">
                      <div className="text-sm">{ai.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {ai.assigned_to_name && `Assigned: ${ai.assigned_to_name} · `}
                        Due: {ai.due_date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${PRIORITY_COLORS[ai.priority] ?? "bg-gray-100"} text-xs`}>{ai.priority}</Badge>
                      <Badge className={`${ACTION_STATUS[ai.status] ?? "bg-gray-100"} text-xs`}>{ai.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActionItemsList() {
  const { data: meetings = [] } = trpc.m15.listMeetings.useQuery();
  // Collect action items from all meetings
  const allActionItems: any[] = [];
  meetings.forEach((m: any) => {
    if (m.actionItems) {
      m.actionItems.forEach((ai: any) => allActionItems.push({ ...ai, meetingTitle: m.title }));
    }
  });

  const openItems = allActionItems.filter((ai: any) => ai.status === "open" || ai.status === "in_progress");
  const overdueItems = allActionItems.filter((ai: any) => ai.status === "overdue");
  const completedItems = allActionItems.filter((ai: any) => ai.status === "completed");

  return (
    <div className="space-y-4">
      {overdueItems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-red-700 mb-2">Overdue ({overdueItems.length})</div>
          {overdueItems.map((ai: any) => <ActionItemRow key={ai.id} item={ai} />)}
        </div>
      )}
      {openItems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[#1a3a3a] mb-2">Open ({openItems.length})</div>
          {openItems.map((ai: any) => <ActionItemRow key={ai.id} item={ai} />)}
        </div>
      )}
      {completedItems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Completed ({completedItems.length})</div>
          {completedItems.map((ai: any) => <ActionItemRow key={ai.id} item={ai} />)}
        </div>
      )}
      {allActionItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No action items.</p>}
    </div>
  );
}

function ActionItemRow({ item: ai }: { item: any }) {
  return (
    <Card className={`mb-2 ${ai.status === "overdue" ? "border-red-200" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm">{ai.description}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {ai.meetingTitle && <span className="text-[#2e8b8b]">{ai.meetingTitle} · </span>}
              {ai.assigned_to_name && `Assigned: ${ai.assigned_to_name} · `}
              Due: {ai.due_date}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`${PRIORITY_COLORS[ai.priority] ?? "bg-gray-100"} text-xs`}>{ai.priority}</Badge>
            <Badge className={`${ACTION_STATUS[ai.status] ?? "bg-gray-100"} text-xs`}>{ai.status}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyHuddleTemplate() {
  const today = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily Huddle — {today}</CardTitle>
            <p className="text-sm text-muted-foreground">SOP Toolkit 4: Daily GRO-to-BHC Clinical Observation Summary</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700">15 minutes</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attendance */}
        <div>
          <Label className="text-xs text-muted-foreground">Required Attendees</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["RCS Lead", "RCS Staff (on duty)", "MHTCM", "Nurse (if on duty)"].map((role) => (
              <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Agenda Items */}
        <div className="space-y-3">
          {[
            { item: "Overnight Report", desc: "Any incidents, behavioral concerns, or medication issues from overnight shift" },
            { item: "Clinical Observations Review", desc: "Review all clinically significant observations from previous 24 hours" },
            { item: "Youth Status Check", desc: "Quick check-in on each youth: mood, behavior, medical concerns" },
            { item: "Upcoming Activities & Appointments", desc: "Family visits, therapy sessions, medical appointments for the day" },
            { item: "Safety & Risk Updates", desc: "Any changes to safety plans, risk levels, or precautionary measures" },
            { item: "Staffing & Coverage", desc: "Shift assignments, coverage gaps, training schedules" },
            { item: "Action Items from Last Huddle", desc: "Follow-up on open action items, mark completed items" },
          ].map((agenda, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2.5 rounded border border-gray-200">
              <div className="w-6 h-6 rounded-full bg-[#2e8b8b] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </div>
              <div>
                <div className="text-sm font-medium">{agenda.item}</div>
                <div className="text-xs text-muted-foreground">{agenda.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Documentation */}
        <div className="bg-[#f0f5f5] p-3 rounded-lg border border-[#2e8b8b]/20">
          <div className="text-xs font-semibold text-[#2e8b8b] mb-1">Documentation Requirement</div>
          <div className="text-xs text-muted-foreground">
            All huddle discussions must be documented in the Daily Observation Summary.
            Clinically significant items must be routed to the assigned clinician within 1 hour.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewMeetingForm() {
  const [form, setForm] = useState({
    meetingType: "case_staffing" as string, title: "", scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "09:00", durationMinutes: 30, facilitatorName: "",
  });

  const createMeeting = trpc.m15.createMeeting.useMutation({ onSuccess: () => setForm({ meetingType: "case_staffing", title: "", scheduledDate: new Date().toISOString().split("T")[0], scheduledTime: "09:00", durationMinutes: 30, facilitatorName: "" }) });
  const handleSubmit = () => { createMeeting.mutate({ title: form.title || "New Meeting", meetingType: form.meetingType, scheduledDate: form.scheduledDate, scheduledTime: form.scheduledTime, durationMinutes: form.durationMinutes, facilitatorName: form.facilitatorName || "Current User" } as any); };

  return (
    <>

      <div className="space-y-4">
      <div>
        <Label className="text-xs">Meeting Type</Label>
        <Select value={form.meetingType} onValueChange={v => setForm({ ...form, meetingType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily_huddle">Daily Huddle</SelectItem>
            <SelectItem value="case_staffing">Case Staffing</SelectItem>
            <SelectItem value="treatment_plan_review">Treatment Plan Review</SelectItem>
            <SelectItem value="family_conference">Family Conference</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Title</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Meeting title" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Time</Label>
          <Input type="time" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Duration (min)</Label>
          <Input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Facilitator</Label>
        <Input value={form.facilitatorName} onChange={e => setForm({ ...form, facilitatorName: e.target.value })} placeholder="Facilitator name" />
      </div>
      <Button onClick={handleSubmit} className="w-full bg-[#2e8b8b] hover:bg-[#1a5a5a]">
        Schedule Meeting
      </Button>
    </div>
  </>
  );
}

export default MeetingCadencePage;
