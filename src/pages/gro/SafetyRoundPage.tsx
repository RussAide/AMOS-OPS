/**
 * SafetyRoundPage.tsx
 * Feature 2 of 6: Safety Round Checklist — area-based checklist
 * List, create, view, and manage safety round checklists.
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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, Search, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, RefreshCw, MapPin, ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const SAFETY_AREAS = [
  "Common Area / Living Room",
  "Kitchen / Dining",
  "Hallways / Stairwells",
  "Bedrooms",
  "Bathrooms",
  "Outdoor / Recreation Yard",
  "Medication Room",
  "Laundry Room",
  "Storage Areas",
  "Emergency Exits",
];

const SHIFT_TYPES = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "overnight", label: "Overnight" },
];

const CHECKLIST_ITEMS = [
  { key: "item1NoHazards", label: "No hazards or unsafe conditions" },
  { key: "item2LightingWorking", label: "All lighting is working" },
  { key: "item3EmergencyExitsClear", label: "Emergency exits are clear" },
  { key: "item4FireExtinguishersOk", label: "Fire extinguishers OK" },
  { key: "item5NoContraband", label: "No contraband found" },
  { key: "item6CleanSanitary", label: "Area is clean and sanitary" },
  { key: "item7EquipmentSecure", label: "Equipment is secure" },
  { key: "item8YouthAreasSafe", label: "Youth areas are safe" },
];

export default function SafetyRoundPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Form state
  const [formArea, setFormArea] = useState("");
  const [formShiftType, setFormShiftType] = useState("day");
  const [formCompletedBy, setFormCompletedBy] = useState("");
  const [formChecks, setFormChecks] = useState<Record<string, boolean>>({});
  const [formHazards, setFormHazards] = useState("");
  const [formCorrective, setFormCorrective] = useState("");
  const [formRequiresFollowUp, setFormRequiresFollowUp] = useState(false);
  const [formFollowUpNotes, setFormFollowUpNotes] = useState("");

  const { data: rounds = [], isLoading } = trpc.groResidential.listSafetyRounds.useQuery(
    filterArea ? { area: filterArea } : undefined
  );

  const { data: detail } = trpc.groResidential.getSafetyRound.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const { data: dashboard } = trpc.groResidential.safetyRoundDashboard.useQuery();

  const createRound = trpc.groResidential.createSafetyRound.useMutation({
    onSuccess: () => {
      utils.groResidential.listSafetyRounds.invalidate();
      utils.groResidential.safetyRoundDashboard.invalidate();
      toast.success("Safety round created");
      resetForm();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRound = trpc.groResidential.updateSafetyRound.useMutation({
    onSuccess: () => {
      utils.groResidential.listSafetyRounds.invalidate();
      utils.groResidential.getSafetyRound.invalidate();
      utils.groResidential.safetyRoundDashboard.invalidate();
      toast.success("Safety round updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRound = trpc.groResidential.deleteSafetyRound.useMutation({
    onSuccess: () => {
      utils.groResidential.listSafetyRounds.invalidate();
      utils.groResidential.safetyRoundDashboard.invalidate();
      toast.success("Safety round deleted");
      setShowDetail(false);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => { utils.groResidential.listSafetyRounds.invalidate(); utils.groResidential.safetyRoundDashboard.invalidate(); toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormArea(""); setFormShiftType("day"); setFormCompletedBy("");
    setFormChecks({}); setFormHazards(""); setFormCorrective("");
    setFormRequiresFollowUp(false); setFormFollowUpNotes("");
  }

  const filtered = rounds.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.area?.toLowerCase().includes(q) || r.completedBy?.toLowerCase().includes(q);
  });

  const allChecked = () => CHECKLIST_ITEMS.every((item) => formChecks[item.key]);

  return (
    <PageLayout category="Residential" title="Safety Round Checklists" subtitle="Area-based safety inspection checklists">
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">

        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Total</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-700">{dashboard?.totalRounds ?? 0}</div><p className="text-xs text-gray-500">Safety rounds</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Passed</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-700">{dashboard?.totalCompleted ?? 0}</div><p className="text-xs text-gray-500">All items passed</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Follow-Up</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-700">{dashboard?.followUpNeeded ?? 0}</div><p className="text-xs text-gray-500">Need follow-up</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Completion</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2e8b8b]">{dashboard?.completionRate ?? 0}%</div>
              <div className="mt-1 w-full bg-gray-100 rounded-full h-1.5"><div className="bg-[#2e8b8b] h-1.5 rounded-full" style={{ width: `${dashboard?.completionRate ?? 0}%` }} /></div>
            </CardContent>
          </Card>
        </div>

        {/* By area summary */}
        {dashboard?.byArea && Object.keys(dashboard.byArea).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Area</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(dashboard.byArea).map(([area, data]) => (
                  <div key={area} className="text-xs p-2 border rounded bg-gray-50">
                    <div className="font-medium truncate">{area}</div>
                    <div className="text-gray-500 mt-0.5">{data.passed}/{data.total} passed</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search safety rounds..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Areas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Areas</SelectItem>
              {SAFETY_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)} className="bg-[#2e8b8b] hover:bg-[#267373]"><Plus className="h-4 w-4 mr-1.5" /> New Round</Button>
          <Button variant="outline" size="icon" onClick={() => seedData.mutate()} disabled={seedData.isPending}>
            <RefreshCw className={cn("h-4 w-4", seedData.isPending && "animate-spin")} />
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed"><CardContent className="p-8 text-center">
            <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No safety rounds found</p>
          </CardContent></Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Area</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Score</TableHead>
                <TableHead className="text-xs">Completed By</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-[60px]"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedId(r.id); setShowDetail(true); }}>
                    <TableCell className="text-xs font-medium">{r.shiftDate}</TableCell>
                    <TableCell className="text-xs">{r.area}</TableCell>
                    <TableCell className="text-xs capitalize">{r.shiftType}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", r.allItemsPassed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
                        {r.itemsPassed}/{r.itemsTotal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.completedBy}</TableCell>
                    <TableCell>
                      {r.requiresFollowUp && !r.reviewedAt ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700"><AlertTriangle className="h-3 w-3 mr-0.5" />Follow-up</Badge>
                      ) : r.reviewedAt ? (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">Reviewed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-gray-400" /></TableCell>
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
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" />New Safety Round</DialogTitle>
              <DialogDescription>Complete a safety round checklist for an area.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Area *</Label>
                  <Select value={formArea} onValueChange={setFormArea}>
                    <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                    <SelectContent>{SAFETY_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Shift Type *</Label>
                  <Select value={formShiftType} onValueChange={setFormShiftType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SHIFT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Completed By *</Label>
                <Input value={formCompletedBy} onChange={(e) => setFormCompletedBy(e.target.value)} placeholder="Staff name" />
              </div>
              <div>
                <Label className="mb-2 block">Checklist Items</Label>
                <div className="space-y-2 border rounded-lg p-3">
                  {CHECKLIST_ITEMS.map((item) => (
                    <div key={item.key} className="flex items-start gap-2">
                      <Checkbox
                        id={item.key}
                        checked={!!formChecks[item.key]}
                        onCheckedChange={(checked) => setFormChecks((prev) => ({ ...prev, [item.key]: checked === true }))}
                      />
                      <Label htmlFor={item.key} className="text-sm font-normal cursor-pointer">{item.label}</Label>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <CheckCircle2 className={cn("h-4 w-4", allChecked() ? "text-green-500" : "text-gray-300")} />
                  <span className={allChecked() ? "text-green-600 font-medium" : "text-gray-500"}>
                    {Object.values(formChecks).filter(Boolean).length} of {CHECKLIST_ITEMS.length} checked
                  </span>
                </div>
              </div>
              <div>
                <Label>Hazards Found</Label>
                <Textarea value={formHazards} onChange={(e) => setFormHazards(e.target.value)} placeholder="Describe any hazards..." rows={2} />
              </div>
              <div>
                <Label>Corrective Action</Label>
                <Textarea value={formCorrective} onChange={(e) => setFormCorrective(e.target.value)} placeholder="Describe corrective actions..." rows={2} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="follow-up" checked={formRequiresFollowUp} onCheckedChange={(c) => setFormRequiresFollowUp(c === true)} />
                <Label htmlFor="follow-up" className="text-sm font-normal cursor-pointer">Requires follow-up</Label>
              </div>
              {formRequiresFollowUp && (
                <div>
                  <Label>Follow-up Notes</Label>
                  <Textarea value={formFollowUpNotes} onChange={(e) => setFormFollowUpNotes(e.target.value)} placeholder="Follow-up details..." rows={2} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createRound.mutate({
                  shiftDate: new Date().toISOString().split("T")[0],
                  shiftType: formShiftType as any,
                  area: formArea,
                  completedBy: formCompletedBy,
                  item1NoHazards: formChecks["item1NoHazards"],
                  item2LightingWorking: formChecks["item2LightingWorking"],
                  item3EmergencyExitsClear: formChecks["item3EmergencyExitsClear"],
                  item4FireExtinguishersOk: formChecks["item4FireExtinguishersOk"],
                  item5NoContraband: formChecks["item5NoContraband"],
                  item6CleanSanitary: formChecks["item6CleanSanitary"],
                  item7EquipmentSecure: formChecks["item7EquipmentSecure"],
                  item8YouthAreasSafe: formChecks["item8YouthAreasSafe"],
                  hazardsFound: formHazards || undefined,
                  correctiveAction: formCorrective || undefined,
                  requiresFollowUp: formRequiresFollowUp,
                  followUpNotes: formFollowUpNotes || undefined,
                })}
                disabled={!formArea || !formCompletedBy || createRound.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createRound.isPending ? "Saving..." : "Save Safety Round"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={showDetail} onOpenChange={(o) => { if (!o) { setShowDetail(false); setSelectedId(null); } }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" />Safety Round Detail</DialogTitle>
              <DialogDescription>{detail && `${detail.shiftDate} · ${detail.area}`}</DialogDescription>
            </DialogHeader>
            {detail && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn(detail.allItemsPassed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
                    {detail.itemsPassed}/{detail.itemsTotal} items passed
                  </Badge>
                  <span className="text-xs text-gray-500">By {detail.completedBy}</span>
                </div>
                <div className="border rounded-lg divide-y">
                  {CHECKLIST_ITEMS.map((item) => {
                    const passed = (detail as any)[item.key] as boolean;
                    return (
                      <div key={item.key} className="flex items-center justify-between p-2.5">
                        <span className="text-sm">{item.label}</span>
                        {passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                    );
                  })}
                </div>
                {detail.hazardsFound && (
                  <div>
                    <Label className="text-xs text-red-600">Hazards Found</Label>
                    <p className="text-sm mt-1 bg-red-50 p-2 rounded text-red-800">{detail.hazardsFound}</p>
                  </div>
                )}
                {detail.correctiveAction && (
                  <div>
                    <Label className="text-xs text-gray-500">Corrective Action</Label>
                    <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{detail.correctiveAction}</p>
                  </div>
                )}
                {detail.requiresFollowUp && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-medium"><AlertTriangle className="h-4 w-4" />Follow-up Required</div>
                    {detail.followUpNotes && <p className="text-xs text-amber-600 mt-1">{detail.followUpNotes}</p>}
                    {detail.reviewedAt && <p className="text-xs text-green-600 mt-1">Reviewed by {detail.reviewedBy} on {new Date(detail.reviewedAt).toLocaleDateString()}</p>}
                  </div>
                )}
                {!detail.reviewedAt && detail.requiresFollowUp && (
                  <Button variant="outline" size="sm" onClick={() => updateRound.mutate({ id: detail.id, reviewedBy: "Supervisor" })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Reviewed
                  </Button>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete?")) deleteRound.mutate({ id: selectedId! }); }}>
                <XCircle className="h-4 w-4 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
