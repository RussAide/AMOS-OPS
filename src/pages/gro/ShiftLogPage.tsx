/**
 * ShiftLogPage.tsx
 * Feature 1 of 6: Shift Log — digital shift log with timestamps
 * List, create, view, and manage shift logs.
 */

import { useState } from "react";
import { PageLayout } from "@/components/shell/PageLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ClipboardList, Plus, Search, Clock, Calendar, Users, ShieldCheck, Heart,
  AlertTriangle, FileText, ChevronRight, RefreshCw, XCircle, CheckCircle2,
  Activity, Play, Square
} from "lucide-react";
import { cn } from "@/lib/utils";

const SHIFT_TYPES = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "overnight", label: "Overnight" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "completed", label: "Completed", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "no_show", label: "No Show", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "absent", label: "Absent", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

export default function ShiftLogPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Form state
  const [formStaffName, setFormStaffName] = useState("");
  const [formShiftType, setFormShiftType] = useState("day");
  const [formNotes, setFormNotes] = useState("");
  const [formSupervisor, setFormSupervisor] = useState("");
  const [entryCategory, setEntryCategory] = useState("");
  const [entryNote, setEntryNote] = useState("");

  const { data: logs = [], isLoading } = trpc.groResidential.listShiftLogs.useQuery(
    filterStatus || filterType ? { status: filterStatus || undefined, shiftType: filterType || undefined } : undefined
  );

  const { data: detail } = trpc.groResidential.getShiftLog.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const { data: dashboard } = trpc.groResidential.residentialDashboard.useQuery();

  const createShift = trpc.groResidential.createShiftLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Shift log created successfully");
      resetForm();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const clockOut = trpc.groResidential.clockOutShiftLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftLogs.invalidate();
      utils.groResidential.getShiftLog.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Shift clocked out");
    },
    onError: (e) => toast.error(e.message),
  });

  const addEntry = trpc.groResidential.addShiftLogEntry.useMutation({
    onSuccess: () => {
      utils.groResidential.getShiftLog.invalidate();
      toast.success("Entry added");
      setEntryCategory("");
      setEntryNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteShift = trpc.groResidential.deleteShiftLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Shift log deleted");
      setShowDetail(false);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => {
      utils.groResidential.listShiftLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormStaffName("");
    setFormShiftType("day");
    setFormNotes("");
    setFormSupervisor("");
  }

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.staffName?.toLowerCase().includes(q) ||
      l.supervisorName?.toLowerCase().includes(q) ||
      l.shiftDate?.includes(q) ||
      l.status?.toLowerCase().includes(q)
    );
  });

  const statusColor = (s: string) =>
    s === "active" ? "bg-green-100 text-green-700 border-green-200" :
    s === "completed" ? "bg-blue-100 text-blue-700 border-blue-200" :
    s === "no_show" ? "bg-red-100 text-red-700 border-red-200" :
    "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <PageLayout category="Residential" title="Shift Logs" subtitle="Digital shift logs with timestamps">
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Active Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{dashboard?.shiftLogs.active ?? 0}</div>
              <p className="text-xs text-gray-500">Currently active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{dashboard?.shiftLogs.today ?? 0}</div>
              <p className="text-xs text-gray-500">Shifts today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-700">{dashboard?.shiftLogs.total ?? 0}</div>
              <p className="text-xs text-gray-500">All shift logs</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search shift logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {SHIFT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)} className="bg-[#2e8b8b] hover:bg-[#267373]">
            <Plus className="h-4 w-4 mr-1.5" /> New Shift
          </Button>
          <Button variant="outline" size="icon" onClick={() => seedData.mutate()} disabled={seedData.isPending}>
            <RefreshCw className={cn("h-4 w-4", seedData.isPending && "animate-spin")} />
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No shift logs found</p>
              <p className="text-xs text-gray-400 mt-1">Create a new shift or seed demo data</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Staff</TableHead>
                  <TableHead className="text-xs">Clock In</TableHead>
                  <TableHead className="text-xs">Clock Out</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Entries</TableHead>
                  <TableHead className="text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => {
                  const entries = JSON.parse(log.entriesJson ?? "[]") as any[];
                  return (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedId(log.id); setShowDetail(true); }}>
                      <TableCell className="text-xs font-medium">{log.shiftDate}</TableCell>
                      <TableCell className="text-xs capitalize">{log.shiftType}</TableCell>
                      <TableCell className="text-xs">{log.staffName}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.clockInAt ? new Date(log.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.clockOutAt ? new Date(log.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", statusColor(log.status))}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entries.length}</TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Modal */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-green-600" />Start New Shift</DialogTitle>
              <DialogDescription>Create a new shift log entry.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Staff Name *</Label>
                <Input value={formStaffName} onChange={(e) => setFormStaffName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Shift Type *</Label>
                <Select value={formShiftType} onValueChange={setFormShiftType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supervisor</Label>
                <Input value={formSupervisor} onChange={(e) => setFormSupervisor(e.target.value)} placeholder="Supervisor name (optional)" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Initial notes..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createShift.mutate({
                  shiftDate: new Date().toISOString().split("T")[0],
                  shiftType: formShiftType as any,
                  staffName: formStaffName,
                  supervisorName: formSupervisor || undefined,
                  notes: formNotes || undefined,
                })}
                disabled={!formStaffName || createShift.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createShift.isPending ? "Creating..." : "Start Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={showDetail} onOpenChange={(o) => { if (!o) { setShowDetail(false); setSelectedId(null); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#2e8b8b]" />
                Shift Log Detail
              </DialogTitle>
              <DialogDescription>
                {detail && `${detail.shiftDate} · ${detail.shiftType} · ${detail.staffName}`}
              </DialogDescription>
            </DialogHeader>
            {detail && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="entries">Entries ({JSON.parse(detail.entriesJson ?? "[]").length})</TabsTrigger>
                  <TabsTrigger value="related">Related</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-xs text-gray-500">Status</span>
                      <Badge variant="outline" className={cn("text-[10px] ml-2", statusColor(detail.status))}>{detail.status}</Badge>
                    </div>
                    <div><span className="text-xs text-gray-500">Clock In</span><div className="font-mono">{new Date(detail.clockInAt).toLocaleString()}</div></div>
                    {detail.clockOutAt && <div><span className="text-xs text-gray-500">Clock Out</span><div className="font-mono">{new Date(detail.clockOutAt).toLocaleString()}</div></div>}
                    <div><span className="text-xs text-gray-500">Supervisor</span><div>{detail.supervisorName ?? "—"}</div></div>
                    <div><span className="text-xs text-gray-500">Safety Rounds</span><div>{detail.safetyRoundsCompleted}</div></div>
                    <div><span className="text-xs text-gray-500">Care Logs</span><div>{detail.careLogsCompleted}</div></div>
                    <div><span className="text-xs text-gray-500">Incidents</span><div>{detail.incidentsReported}</div></div>
                  </div>
                  {detail.notes && (
                    <div>
                      <span className="text-xs text-gray-500">Notes</span>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{detail.notes}</p>
                    </div>
                  )}
                  {detail.status === "active" && (
                    <Button variant="outline" onClick={() => clockOut.mutate({ id: detail.id })} disabled={clockOut.isPending}>
                      <Square className="h-4 w-4 mr-1.5" /> Clock Out
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="entries" className="space-y-3">
                  {detail.status === "active" && (
                    <div className="flex gap-2">
                      <Input placeholder="Category" value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} className="text-xs w-32" />
                      <Input placeholder="Note text..." value={entryNote} onChange={(e) => setEntryNote(e.target.value)} className="text-xs flex-1" />
                      <Button size="sm" onClick={() => addEntry.mutate({ id: detail.id, category: entryCategory, note: entryNote })} disabled={!entryCategory || !entryNote}>
                        Add
                      </Button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(JSON.parse(detail.entriesJson ?? "[]") as any[]).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No entries yet</p>
                    ) : (
                      (JSON.parse(detail.entriesJson ?? "[]") as any[]).map((entry, i) => (
                        <div key={i} className="flex gap-3 text-sm p-2 bg-gray-50 rounded">
                          <span className="font-mono text-[10px] text-gray-500 shrink-0 w-[80px]">
                            {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge variant="outline" className="text-[9px] shrink-0 h-5">{entry.category}</Badge>
                          <span className="text-xs">{entry.note}</span>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="related" className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">Safety Rounds ({detail.safetyRounds?.length ?? 0})</h4>
                    {detail.safetyRounds?.map((r) => (
                      <div key={r.id} className="text-xs p-2 border rounded mb-1 flex justify-between">
                        <span>{r.area}</span>
                        <Badge variant="outline" className={cn("text-[9px]", r.allItemsPassed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                          {r.itemsPassed}/{r.itemsTotal}
                        </Badge>
                      </div>
                    )) ?? <p className="text-xs text-gray-400">None</p>}
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">Care Logs ({detail.careLogs?.length ?? 0})</h4>
                    {detail.careLogs?.map((c) => (
                      <div key={c.id} className="text-xs p-2 border rounded mb-1">
                        <span className="font-medium">{c.youthName}</span> — <Badge variant="outline" className="text-[9px]">{c.careType}</Badge>
                      </div>
                    )) ?? <p className="text-xs text-gray-400">None</p>}
                  </div>
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete this shift log?")) deleteShift.mutate({ id: selectedId! }); }}>
                <XCircle className="h-4 w-4 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
