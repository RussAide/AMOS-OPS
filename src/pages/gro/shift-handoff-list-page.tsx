/**
 * ShiftHandoffListPage.tsx
 * Feature 6 of 6: Shift Handoff — end-of-shift summary
 * List, create, view, and manage shift handoffs.
 */

import { useState } from "react";
import { PageLayout } from "@/components/shell/page-layout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Plus,
  Search,
  Clock,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Activity,
  FileCheck,
  Pill,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";

interface YouthStatusEntry {
  name: string;
  status: string;
  concerns?: string;
}

export default function ShiftHandoffListPage() {
  const { workspace } = useAuth();
  const demonstrationWorkspace =
    runtimeConfig.evaluationMode || workspace === "training";
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "pending" | "in_progress" | "completed"
  >("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Form state
  const [formToStaff, setFormToStaff] = useState("");
  const [formYouthStatus, setFormYouthStatus] = useState("");
  const [formPending, setFormPending] = useState("");
  const [formMedications, setFormMedications] = useState("");
  const [formAppointments, setFormAppointments] = useState("");
  const [formAlerts, setFormAlerts] = useState("");
  const [formSafety, setFormSafety] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: handoffs = [], isLoading } =
    trpc.groResidential.listShiftHandoffs.useQuery(
      filterStatus ? { status: filterStatus } : undefined,
    );

  const { data: detail } = trpc.groResidential.getShiftHandoff.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const { data: dashboard } =
    trpc.groResidential.residentialDashboard.useQuery();

  const createHandoff = trpc.groResidential.createShiftHandoff.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftHandoffs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Shift handoff created");
      resetForm();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const completeHandoff = trpc.groResidential.completeShiftHandoff.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftHandoffs.invalidate();
      utils.groResidential.getShiftHandoff.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Handoff completed");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHandoff = trpc.groResidential.deleteShiftHandoff.useMutation({
    onSuccess: () => {
      utils.groResidential.listShiftHandoffs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Deleted");
      setShowDetail(false);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => {
      utils.groResidential.listShiftHandoffs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormToStaff("");
    setFormYouthStatus("");
    setFormPending("");
    setFormMedications("");
    setFormAppointments("");
    setFormAlerts("");
    setFormSafety("");
    setFormNotes("");
  }

  const filtered = handoffs.filter((h) => {
    const q = search.toLowerCase();
    return (
      !q ||
      h.fromStaffName?.toLowerCase().includes(q) ||
      h.toStaffName?.toLowerCase().includes(q) ||
      h.handoffDate?.includes(q)
    );
  });

  const statusColor = (s: string) =>
    s === "completed"
      ? "bg-green-100 text-green-700 border-green-200"
      : s === "in_progress"
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <PageLayout
      category="Residential"
      title="Shift Handoffs"
      subtitle="End-of-shift summaries and transfers"
    >
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">
        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-700">
                {dashboard?.shiftHandoffs.total ?? 0}
              </div>
              <p className="text-xs text-gray-500">Handoff records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {dashboard?.shiftHandoffs.pending ?? 0}
              </div>
              <p className="text-xs text-gray-500">Awaiting completion</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {handoffs.filter((h) => h.status === "completed").length}
              </div>
              <p className="text-xs text-gray-500">Completed handoffs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {
                  handoffs.filter(
                    (h) =>
                      h.handoffDate === new Date().toISOString().split("T")[0],
                  ).length
                }
              </div>
              <p className="text-xs text-gray-500">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search handoffs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterStatus}
            onValueChange={(value) =>
              setFilterStatus(value as typeof filterStatus)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#2e8b8b] hover:bg-[#267373]"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Handoff
          </Button>
          {demonstrationWorkspace && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => seedData.mutate()}
              disabled={seedData.isPending}
            >
              <RefreshCw
                className={cn("h-4 w-4", seedData.isPending && "animate-spin")}
              />
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <ClipboardCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No shift handoffs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">From</TableHead>
                  <TableHead className="text-xs">To</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Alerts</TableHead>
                  <TableHead className="text-xs">Completed</TableHead>
                  <TableHead className="text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow
                    key={h.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedId(h.id);
                      setShowDetail(true);
                    }}
                  >
                    <TableCell className="text-xs font-medium">
                      {h.handoffDate}
                    </TableCell>
                    <TableCell className="text-xs">{h.fromStaffName}</TableCell>
                    <TableCell className="text-xs">
                      {h.toStaffName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", statusColor(h.status))}
                      >
                        {h.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.highPriorityAlerts ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-red-50 text-red-700 mr-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Alert
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.completedAt
                        ? new Date(h.completedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Modal */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-teal-600" />
                New Shift Handoff
              </DialogTitle>
              <DialogDescription>
                Create a shift handoff summary.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From Staff</Label>
                  <p className="text-xs text-gray-500 pt-2">
                    Recorded from your authenticated account
                  </p>
                </div>
                <div>
                  <Label>To Staff</Label>
                  <Input
                    value={formToStaff}
                    onChange={(e) => setFormToStaff(e.target.value)}
                    placeholder="Incoming staff (optional)"
                  />
                </div>
              </div>
              <div>
                <Label>Youth Status Summary</Label>
                <Textarea
                  value={formYouthStatus}
                  onChange={(e) => setFormYouthStatus(e.target.value)}
                  placeholder="Status of each resident..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Pending Items</Label>
                <Textarea
                  value={formPending}
                  onChange={(e) => setFormPending(e.target.value)}
                  placeholder="Tasks to pass on..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Medication Updates</Label>
                <Textarea
                  value={formMedications}
                  onChange={(e) => setFormMedications(e.target.value)}
                  placeholder="Medication status..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Appointment Reminders</Label>
                <Input
                  value={formAppointments}
                  onChange={(e) => setFormAppointments(e.target.value)}
                  placeholder="Upcoming appointments..."
                />
              </div>
              <div>
                <Label>High Priority Alerts</Label>
                <Textarea
                  value={formAlerts}
                  onChange={(e) => setFormAlerts(e.target.value)}
                  placeholder="Any critical alerts..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Safety Alerts</Label>
                <Textarea
                  value={formSafety}
                  onChange={(e) => setFormSafety(e.target.value)}
                  placeholder="Safety-related alerts..."
                  rows={2}
                />
              </div>
              <div>
                <Label>General Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createHandoff.mutate({
                    fromShiftId: randomId(),
                    handoffDate: new Date().toISOString().split("T")[0],
                    toStaffName: formToStaff || undefined,
                    youthStatusJson: formYouthStatus || undefined,
                    pendingItems: formPending || undefined,
                    medicationUpdates: formMedications || undefined,
                    appointmentReminders: formAppointments || undefined,
                    highPriorityAlerts: formAlerts || undefined,
                    safetyAlerts: formSafety || undefined,
                    generalNotes: formNotes || undefined,
                  })
                }
                disabled={createHandoff.isPending}
                className="bg-[#2e8b8b] hover:bg-[#267373]"
              >
                {createHandoff.isPending ? "Creating..." : "Create Handoff"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog
          open={showDetail}
          onOpenChange={(o) => {
            if (!o) {
              setShowDetail(false);
              setSelectedId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-teal-600" />
                Shift Handoff Detail
              </DialogTitle>
              <DialogDescription>
                {detail &&
                  `${detail.handoffDate} · ${detail.fromStaffName} → ${detail.toStaffName ?? "?"}`}
              </DialogDescription>
            </DialogHeader>
            {detail && (
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="youth">Youth Status</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", statusColor(detail.status))}
                    >
                      {detail.status}
                    </Badge>
                    {detail.completedAt && (
                      <span className="text-xs text-gray-500">
                        Completed:{" "}
                        {new Date(detail.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-500">From</span>
                      <div className="font-medium">{detail.fromStaffName}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">To</span>
                      <div className="font-medium">
                        {detail.toStaffName ?? "—"}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    {detail.pendingItems && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <Activity className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-amber-700">
                            Pending Items
                          </div>
                          <p className="text-xs text-amber-600 mt-0.5">
                            {detail.pendingItems}
                          </p>
                        </div>
                      </div>
                    )}
                    {detail.medicationUpdates && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <Pill className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-blue-700">
                            Medications
                          </div>
                          <p className="text-xs text-blue-600 mt-0.5">
                            {detail.medicationUpdates}
                          </p>
                        </div>
                      </div>
                    )}
                    {detail.appointmentReminders && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                        <Bell className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-green-700">
                            Appointments
                          </div>
                          <p className="text-xs text-green-600 mt-0.5">
                            {detail.appointmentReminders}
                          </p>
                        </div>
                      </div>
                    )}
                    {detail.highPriorityAlerts && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-red-700">
                            High Priority Alerts
                          </div>
                          <p className="text-xs text-red-600 mt-0.5">
                            {detail.highPriorityAlerts}
                          </p>
                        </div>
                      </div>
                    )}
                    {detail.safetyAlerts && (
                      <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                        <ShieldCheck className="h-4 w-4 text-orange-600 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-orange-700">
                            Safety Alerts
                          </div>
                          <p className="text-xs text-orange-600 mt-0.5">
                            {detail.safetyAlerts}
                          </p>
                        </div>
                      </div>
                    )}
                    {detail.generalNotes && (
                      <div>
                        <Label className="text-xs text-gray-500">
                          General Notes
                        </Label>
                        <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                          {detail.generalNotes}
                        </p>
                      </div>
                    )}
                  </div>
                  {detail.status === "pending" && (
                    <Button
                      onClick={() =>
                        completeHandoff.mutate({
                          id: detail.id,
                        })
                      }
                      className="bg-[#2e8b8b] hover:bg-[#267373]"
                    >
                      <FileCheck className="h-4 w-4 mr-1.5" /> Complete Handoff
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="youth" className="space-y-3">
                  {detail.youthStatusJson ? (
                    <div className="space-y-2">
                      {Array.isArray(JSON.parse(detail.youthStatusJson))
                        ? (
                            JSON.parse(
                              detail.youthStatusJson,
                            ) as YouthStatusEntry[]
                          ).map((y, i: number) => (
                            <Card key={i}>
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {y.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px]",
                                      y.status === "stable"
                                        ? "bg-green-50 text-green-700"
                                        : y.status === "monitoring"
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-red-50 text-red-700",
                                    )}
                                  >
                                    {y.status}
                                  </Badge>
                                </div>
                                {y.concerns && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {y.concerns}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))
                        : null}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">
                      No youth status recorded
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete?"))
                    deleteHandoff.mutate({ id: selectedId! });
                }}
              >
                <XCircle className="h-4 w-4 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}
