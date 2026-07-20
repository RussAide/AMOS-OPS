/**
 * SupervisionNotesPage.tsx
 * Feature 5 of 6: Supervision Documentation — supervision notes
 * List, create, view, and manage supervision documentation.
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Search,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Target,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";

interface SupervisionActionItem {
  task: string;
  due?: string;
}

const SUPERVISION_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "group", label: "Group" },
  { value: "crisis_debrief", label: "Crisis Debrief" },
  { value: "incident_review", label: "Incident Review" },
  { value: "training", label: "Training" },
  { value: "observation", label: "Observation" },
] as const;
type SupervisionType = (typeof SUPERVISION_TYPES)[number]["value"];

export default function SupervisionNotesPage() {
  const utils = trpc.useUtils();
  const { workspace } = useAuth();
  const demonstrationWorkspace =
    runtimeConfig.evaluationMode || workspace === "training";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | SupervisionType>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [formType, setFormType] = useState("individual");
  const [formSupervisor, setFormSupervisor] = useState("");
  const [formSupervisee, setFormSupervisee] = useState("");
  const [formTopics, setFormTopics] = useState("");
  const [formConcerns, setFormConcerns] = useState("");
  const [formObservations, setFormObservations] = useState("");
  const [formTraining, setFormTraining] = useState("");
  const [formGoals, setFormGoals] = useState("");
  const [formFollowUp, setFormFollowUp] = useState(false);
  const [formFollowUpDate, setFormFollowUpDate] = useState("");
  const [formFollowUpTopics, setFormFollowUpTopics] = useState("");

  const {
    data: notes = [],
    isLoading,
    isError,
  } = trpc.groResidential.listSupervisionNotes.useQuery(
    filterType ? { supervisionType: filterType } : undefined,
  );

  const { data: detail } = trpc.groResidential.getSupervisionNote.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const { data: dashboard } =
    trpc.groResidential.residentialDashboard.useQuery();

  const createNote = trpc.groResidential.createSupervisionNote.useMutation({
    onSuccess: () => {
      utils.groResidential.listSupervisionNotes.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Supervision note created");
      resetForm();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const acknowledge =
    trpc.groResidential.acknowledgeSupervisionNote.useMutation({
      onSuccess: () => {
        utils.groResidential.listSupervisionNotes.invalidate();
        utils.groResidential.getSupervisionNote.invalidate();
        utils.groResidential.residentialDashboard.invalidate();
        toast.success("Acknowledged");
      },
      onError: (e) => toast.error(e.message),
    });

  const deleteNote = trpc.groResidential.deleteSupervisionNote.useMutation({
    onSuccess: () => {
      utils.groResidential.listSupervisionNotes.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Deleted");
      setShowDetail(false);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => {
      utils.groResidential.listSupervisionNotes.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormType("individual");
    setFormSupervisor("");
    setFormSupervisee("");
    setFormTopics("");
    setFormConcerns("");
    setFormObservations("");
    setFormTraining("");
    setFormGoals("");
    setFormFollowUp(false);
    setFormFollowUpDate("");
    setFormFollowUpTopics("");
  }

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    return (
      !q ||
      n.superviseeName?.toLowerCase().includes(q) ||
      n.supervisorName?.toLowerCase().includes(q) ||
      n.topicsDiscussed?.toLowerCase().includes(q)
    );
  });

  const typeLabel = (v: string) =>
    SUPERVISION_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <PageLayout
      category="Residential"
      title="Supervision Documentation"
      subtitle="Supervision notes and staff development records"
    >
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">
        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">
                {dashboard?.supervisionNotes.total ?? 0}
              </div>
              <p className="text-xs text-gray-500">Supervision notes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {dashboard?.supervisionNotes.pendingAcknowledgment ?? 0}
              </div>
              <p className="text-xs text-gray-500">Need acknowledgment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Acked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {notes.filter((n) => n.superviseeAcknowledged).length}
              </div>
              <p className="text-xs text-gray-500">Acknowledged</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> With Follow-Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {notes.filter((n) => n.followUpRequired).length}
              </div>
              <p className="text-xs text-gray-500">Have follow-up</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search supervision notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as typeof filterType)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {SUPERVISION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#2e8b8b] hover:bg-[#267373]"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Note
          </Button>
          {demonstrationWorkspace && (
            <Button
              aria-label="Seed demonstration data"
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
        ) : isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center text-sm text-red-800">
              Connected supervision data is unavailable. No demonstration
              records were substituted.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No supervision notes found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Supervisor</TableHead>
                  <TableHead className="text-xs">Supervisee</TableHead>
                  <TableHead className="text-xs">Topics</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => (
                  <TableRow
                    key={n.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedId(n.id);
                      setShowDetail(true);
                    }}
                  >
                    <TableCell className="text-xs font-medium">
                      {n.supervisionDate}
                    </TableCell>
                    <TableCell className="text-xs">
                      {typeLabel(n.supervisionType)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {n.supervisorName}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {n.superviseeName}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {n.topicsDiscussed}
                    </TableCell>
                    <TableCell>
                      {n.superviseeAcknowledged ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-green-50 text-green-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />
                          Acked
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700"
                        >
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Pending
                        </Badge>
                      )}
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
                <BookOpen className="h-5 w-5 text-indigo-600" />
                New Supervision Note
              </DialogTitle>
              <DialogDescription>
                Document a supervision session.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPERVISION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Supervisor *</Label>
                  <Input
                    value={formSupervisor}
                    onChange={(e) => setFormSupervisor(e.target.value)}
                    placeholder="Supervisor name"
                  />
                </div>
                <div>
                  <Label>Supervisee *</Label>
                  <Input
                    value={formSupervisee}
                    onChange={(e) => setFormSupervisee(e.target.value)}
                    placeholder="Supervisee name"
                  />
                </div>
              </div>
              <div>
                <Label>Topics Discussed *</Label>
                <Textarea
                  value={formTopics}
                  onChange={(e) => setFormTopics(e.target.value)}
                  placeholder="Main topics covered in supervision..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Staff Concerns</Label>
                <Textarea
                  value={formConcerns}
                  onChange={(e) => setFormConcerns(e.target.value)}
                  placeholder="Any concerns raised..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Performance Observations</Label>
                <Textarea
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  placeholder="Observations on performance..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Training Needs</Label>
                <Input
                  value={formTraining}
                  onChange={(e) => setFormTraining(e.target.value)}
                  placeholder="Identified training needs..."
                />
              </div>
              <div>
                <Label>Goals Set</Label>
                <Textarea
                  value={formGoals}
                  onChange={(e) => setFormGoals(e.target.value)}
                  placeholder="Goals established..."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sup-follow-up"
                  checked={formFollowUp}
                  onChange={(e) => setFormFollowUp(e.target.checked)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="sup-follow-up"
                  className="text-sm font-normal cursor-pointer"
                >
                  Follow-up required
                </Label>
              </div>
              {formFollowUp && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Follow-up Date</Label>
                    <Input
                      type="date"
                      value={formFollowUpDate}
                      onChange={(e) => setFormFollowUpDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Follow-up Topics</Label>
                    <Input
                      value={formFollowUpTopics}
                      onChange={(e) => setFormFollowUpTopics(e.target.value)}
                      placeholder="Topics to follow up on"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createNote.mutate({
                    supervisionDate: formDate,
                    supervisionType: formType as Parameters<
                      typeof createNote.mutate
                    >[0]["supervisionType"],
                    supervisorName: formSupervisor,
                    superviseeName: formSupervisee,
                    topicsDiscussed: formTopics,
                    staffConcerns: formConcerns || undefined,
                    performanceObservations: formObservations || undefined,
                    trainingNeeds: formTraining || undefined,
                    goalsSet: formGoals || undefined,
                    followUpRequired: formFollowUp,
                    followUpDate: formFollowUpDate || undefined,
                    followUpTopics: formFollowUpTopics || undefined,
                  })
                }
                disabled={
                  !formDate ||
                  !formSupervisor ||
                  !formSupervisee ||
                  !formTopics ||
                  createNote.isPending
                }
                className="bg-[#2e8b8b] hover:bg-[#267373]"
              >
                {createNote.isPending ? "Saving..." : "Save Note"}
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
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Supervision Note
              </DialogTitle>
              <DialogDescription>
                {detail &&
                  `${detail.supervisionDate} · ${typeLabel(detail.supervisionType)}`}
              </DialogDescription>
            </DialogHeader>
            {detail && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {typeLabel(detail.supervisionType)}
                  </Badge>
                  {detail.superviseeAcknowledged ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-green-50 text-green-700"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Acknowledged
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700"
                    >
                      Pending Ack
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Supervisor</span>
                    <div className="font-medium">{detail.supervisorName}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Supervisee</span>
                    <div className="font-medium">{detail.superviseeName}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Topics Discussed
                  </Label>
                  <p className="text-sm mt-1 bg-indigo-50 p-3 rounded">
                    {detail.topicsDiscussed}
                  </p>
                </div>
                {detail.staffConcerns && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Staff Concerns
                    </Label>
                    <p className="text-sm mt-1">{detail.staffConcerns}</p>
                  </div>
                )}
                {detail.performanceObservations && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Performance Observations
                    </Label>
                    <p className="text-sm mt-1">
                      {detail.performanceObservations}
                    </p>
                  </div>
                )}
                {detail.trainingNeeds && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Training Needs
                    </Label>
                    <p className="text-sm mt-1">{detail.trainingNeeds}</p>
                  </div>
                )}
                {detail.goalsSet && (
                  <div>
                    <Label className="text-xs text-gray-500">Goals Set</Label>
                    <p className="text-sm mt-1 bg-green-50 p-2 rounded">
                      {detail.goalsSet}
                    </p>
                  </div>
                )}
                {detail.actionItems && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Action Items
                    </Label>
                    <div className="mt-1 space-y-1">
                      {Array.isArray(JSON.parse(detail.actionItems))
                        ? (
                            JSON.parse(
                              detail.actionItems,
                            ) as SupervisionActionItem[]
                          ).map((item, i: number) => (
                            <div
                              key={i}
                              className="text-xs p-2 border rounded flex justify-between"
                            >
                              <span>{item.task}</span>
                              {item.due && (
                                <Badge variant="outline" className="text-[9px]">
                                  Due: {item.due}
                                </Badge>
                              )}
                            </div>
                          ))
                        : null}
                    </div>
                  </div>
                )}
                {detail.followUpRequired && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                      <Target className="h-4 w-4" />
                      Follow-up Required
                    </div>
                    {detail.followUpDate && (
                      <p className="text-xs text-blue-600 mt-1">
                        Date: {detail.followUpDate}
                      </p>
                    )}
                    {detail.followUpTopics && (
                      <p className="text-xs text-blue-600 mt-1">
                        Topics: {detail.followUpTopics}
                      </p>
                    )}
                  </div>
                )}
                {!detail.superviseeAcknowledged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => acknowledge.mutate({ id: detail.id })}
                  >
                    <UserCheck className="h-4 w-4 mr-1" /> Acknowledge
                  </Button>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete?"))
                    deleteNote.mutate({ id: selectedId! });
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
