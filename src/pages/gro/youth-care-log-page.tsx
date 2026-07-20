/**
 * YouthCareLogPage.tsx
 * Feature 3 of 6: Youth Care Log — per-resident care entries
 * List, create, view, and manage youth care log entries.
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
  Heart,
  Plus,
  Search,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Stethoscope,
  Brain,
  School,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";

const CARE_TYPES = [
  { value: "daily_living", label: "Daily Living", icon: Clock },
  { value: "behavioral", label: "Behavioral", icon: Brain },
  { value: "medical", label: "Medical", icon: Stethoscope },
  { value: "educational", label: "Educational", icon: School },
  { value: "recreational", label: "Recreational", icon: Gamepad2 },
  { value: "emotional_support", label: "Emotional Support", icon: Heart },
  {
    value: "crisis_intervention",
    label: "Crisis Intervention",
    icon: AlertTriangle,
  },
] as const;
type CareType = (typeof CARE_TYPES)[number]["value"];

const SHIFT_TYPES = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "overnight", label: "Overnight" },
];

export default function YouthCareLogPage() {
  const utils = trpc.useUtils();
  const { workspace } = useAuth();
  const demonstrationWorkspace =
    runtimeConfig.evaluationMode || workspace === "training";
  const [search, setSearch] = useState("");
  const [filterCareType, setFilterCareType] = useState<"" | CareType>("");
  const [filterFollowUp, setFilterFollowUp] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Form state
  const [formYouthName, setFormYouthName] = useState("");
  const [formYouthId, setFormYouthId] = useState("");
  const [formMrn, setFormMrn] = useState("");
  const [formCareType, setFormCareType] = useState("daily_living");
  const [formShiftType, setFormShiftType] = useState("day");
  const [formDescription, setFormDescription] = useState("");
  const [formObservations, setFormObservations] = useState("");
  const [formYouthResponse, setFormYouthResponse] = useState("");
  const [formOutcome, setFormOutcome] = useState("");
  const [formFollowUp, setFormFollowUp] = useState(false);
  const [formFollowUpActions, setFormFollowUpActions] = useState("");
  const [formRecordedBy, setFormRecordedBy] = useState("");

  const {
    data: logs = [],
    isLoading,
    isError,
  } = trpc.groResidential.listYouthCareLogs.useQuery(
    filterCareType || filterFollowUp
      ? {
          careType: filterCareType || undefined,
          followUpNeeded: filterFollowUp || undefined,
        }
      : undefined,
  );

  const { data: detail } = trpc.groResidential.getYouthCareLog.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const { data: dashboard } =
    trpc.groResidential.residentialDashboard.useQuery();

  const createLog = trpc.groResidential.createYouthCareLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listYouthCareLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Care log created");
      resetForm();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLog = trpc.groResidential.updateYouthCareLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listYouthCareLogs.invalidate();
      utils.groResidential.getYouthCareLog.invalidate();
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLog = trpc.groResidential.deleteYouthCareLog.useMutation({
    onSuccess: () => {
      utils.groResidential.listYouthCareLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Deleted");
      setShowDetail(false);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => {
      utils.groResidential.listYouthCareLogs.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormYouthName("");
    setFormYouthId("");
    setFormMrn("");
    setFormCareType("daily_living");
    setFormShiftType("day");
    setFormDescription("");
    setFormObservations("");
    setFormYouthResponse("");
    setFormOutcome("");
    setFormFollowUp(false);
    setFormFollowUpActions("");
    setFormRecordedBy("");
  }

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.youthName?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.recordedBy?.toLowerCase().includes(q)
    );
  });

  const careTypeLabel = (v: string) =>
    CARE_TYPES.find((c) => c.value === v)?.label ?? v;
  const careTypeColor = (v: string) => {
    const map: Record<string, string> = {
      daily_living: "bg-blue-100 text-blue-700",
      behavioral: "bg-purple-100 text-purple-700",
      medical: "bg-red-100 text-red-700",
      educational: "bg-green-100 text-green-700",
      recreational: "bg-amber-100 text-amber-700",
      emotional_support: "bg-pink-100 text-pink-700",
      crisis_intervention: "bg-orange-100 text-orange-700",
    };
    return map[v] ?? "bg-gray-100 text-gray-700";
  };

  return (
    <PageLayout
      category="Residential"
      title="Youth Care Logs"
      subtitle="Per-resident care entries"
    >
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">
        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-700">
                {dashboard?.youthCareLogs.total ?? 0}
              </div>
              <p className="text-xs text-gray-500">Care log entries</p>
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
                {dashboard?.youthCareLogs.today ?? 0}
              </div>
              <p className="text-xs text-gray-500">Entries today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Follow-Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {dashboard?.youthCareLogs.followUpNeeded ?? 0}
              </div>
              <p className="text-xs text-gray-500">Need follow-up</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {logs.filter((l) => l.reviewedBy).length}
              </div>
              <p className="text-xs text-gray-500">Reviewed entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search care logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterCareType}
            onValueChange={(value) =>
              setFilterCareType(value as typeof filterCareType)
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {CARE_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={filterFollowUp ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterFollowUp(!filterFollowUp)}
            className={filterFollowUp ? "bg-amber-600" : ""}
          >
            <AlertTriangle className="h-4 w-4 mr-1" /> Follow-Up
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#2e8b8b] hover:bg-[#267373]"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Log
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
              Connected youth-care data is unavailable. No demonstration records
              were substituted.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Heart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No care logs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Resident</TableHead>
                  <TableHead className="text-xs">Care Type</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Recorded By</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow
                    key={l.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setSelectedId(l.id);
                      setShowDetail(true);
                    }}
                  >
                    <TableCell className="text-xs font-medium">
                      {l.logDate}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {l.youthName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", careTypeColor(l.careType))}
                      >
                        {careTypeLabel(l.careType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {l.description}
                    </TableCell>
                    <TableCell className="text-xs">{l.recordedBy}</TableCell>
                    <TableCell>
                      {l.followUpNeeded && !l.reviewedBy ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700"
                        >
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Follow-up
                        </Badge>
                      ) : l.reviewedBy ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-50 text-blue-700"
                        >
                          Reviewed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-green-50 text-green-700"
                        >
                          Logged
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
                <Heart className="h-5 w-5 text-pink-500" />
                New Youth Care Log
              </DialogTitle>
              <DialogDescription>
                Record a care activity for a resident.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Youth Name *</Label>
                  <Input
                    value={formYouthName}
                    onChange={(e) => setFormYouthName(e.target.value)}
                    placeholder="Resident name"
                  />
                </div>
                <div>
                  <Label>MRN *</Label>
                  <Input
                    value={formMrn}
                    onChange={(e) => setFormMrn(e.target.value)}
                    placeholder="Medical record number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Care Type *</Label>
                  <Select value={formCareType} onValueChange={setFormCareType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARE_TYPES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Shift Type *</Label>
                  <Select
                    value={formShiftType}
                    onValueChange={setFormShiftType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the care provided..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Observations</Label>
                <Textarea
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  placeholder="Any observations..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Youth Response</Label>
                <Input
                  value={formYouthResponse}
                  onChange={(e) => setFormYouthResponse(e.target.value)}
                  placeholder="How did the youth respond?"
                />
              </div>
              <div>
                <Label>Outcome</Label>
                <Input
                  value={formOutcome}
                  onChange={(e) => setFormOutcome(e.target.value)}
                  placeholder="Outcome of care..."
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="care-follow-up"
                  checked={formFollowUp}
                  onChange={(e) => setFormFollowUp(e.target.checked)}
                  className="mt-1"
                />
                <Label
                  htmlFor="care-follow-up"
                  className="text-sm font-normal cursor-pointer"
                >
                  Follow-up needed
                </Label>
              </div>
              {formFollowUp && (
                <div>
                  <Label>Follow-up Actions</Label>
                  <Textarea
                    value={formFollowUpActions}
                    onChange={(e) => setFormFollowUpActions(e.target.value)}
                    placeholder="Describe follow-up actions..."
                    rows={2}
                  />
                </div>
              )}
              <div>
                <Label>Recorded By *</Label>
                <Input
                  value={formRecordedBy}
                  onChange={(e) => setFormRecordedBy(e.target.value)}
                  placeholder="Staff name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createLog.mutate({
                    youthId: formYouthId || randomId(),
                    youthName: formYouthName,
                    mrn: formMrn,
                    logDate: new Date().toISOString().split("T")[0],
                    shiftType: formShiftType as Parameters<
                      typeof createLog.mutate
                    >[0]["shiftType"],
                    careType: formCareType as Parameters<
                      typeof createLog.mutate
                    >[0]["careType"],
                    description: formDescription,
                    observations: formObservations || undefined,
                    youthResponse: formYouthResponse || undefined,
                    outcome: formOutcome || undefined,
                    followUpNeeded: formFollowUp,
                    followUpActions: formFollowUpActions || undefined,
                    recordedBy: formRecordedBy,
                  })
                }
                disabled={
                  !formYouthName ||
                  !formMrn ||
                  !formDescription ||
                  !formRecordedBy ||
                  createLog.isPending
                }
                className="bg-[#2e8b8b] hover:bg-[#267373]"
              >
                {createLog.isPending ? "Saving..." : "Save Care Log"}
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Care Log Detail
              </DialogTitle>
              <DialogDescription>
                {detail && `${detail.logDate} · ${detail.youthName}`}
              </DialogDescription>
            </DialogHeader>
            {detail && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      careTypeColor(detail.careType),
                    )}
                  >
                    {careTypeLabel(detail.careType)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {detail.shiftType}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-gray-500">Description</Label>
                  <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                    {detail.description}
                  </p>
                </div>
                {detail.observations && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Observations
                    </Label>
                    <p className="text-sm mt-1">{detail.observations}</p>
                  </div>
                )}
                {detail.youthResponse && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Youth Response
                    </Label>
                    <p className="text-sm mt-1">{detail.youthResponse}</p>
                  </div>
                )}
                {detail.outcome && (
                  <div>
                    <Label className="text-xs text-gray-500">Outcome</Label>
                    <p className="text-sm mt-1">{detail.outcome}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">MRN</span>
                    <div className="font-mono">{detail.mrn}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Recorded By</span>
                    <div>{detail.recordedBy}</div>
                  </div>
                </div>
                {detail.followUpNeeded && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Follow-up Required
                    </div>
                    {detail.followUpActions && (
                      <p className="text-xs text-amber-600 mt-1">
                        {detail.followUpActions}
                      </p>
                    )}
                  </div>
                )}
                {!detail.reviewedBy && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateLog.mutate({
                        id: detail.id,
                        reviewedBy: "Supervisor",
                      })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Reviewed
                  </Button>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete?")) deleteLog.mutate({ id: selectedId! });
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
