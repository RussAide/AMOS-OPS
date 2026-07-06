/**
 * IncidentReportPage.tsx
 * Feature 4 of 6: Incident Report — residential incident reports
 * List, create, view, edit, and manage incident reports with status workflows.
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
  AlertTriangle, Plus, Search, ShieldAlert, Clock, Calendar, User,
  CheckCircle2, XCircle, ChevronRight, RefreshCw, FileWarning,
  Phone, Stethoscope, Send, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

const INCIDENT_TYPES = [
  { value: "behavioral", label: "Behavioral" },
  { value: "safety", label: "Safety" },
  { value: "medication", label: "Medication" },
  { value: "injury", label: "Injury" },
  { value: "elopement", label: "Elopement" },
  { value: "self_harm", label: "Self Harm" },
  { value: "aggression", label: "Aggression" },
  { value: "property_damage", label: "Property Damage" },
  { value: "seclusion", label: "Seclusion" },
  { value: "restraint", label: "Restraint" },
  { value: "other", label: "Other" },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open", color: "bg-red-100 text-red-700" },
  { value: "under_review", label: "Under Review", color: "bg-amber-100 text-amber-700" },
  { value: "pending_supervisor", label: "Pending Supervisor", color: "bg-purple-100 text-purple-700" },
  { value: "resolved", label: "Resolved", color: "bg-green-100 text-green-700" },
  { value: "closed", label: "Closed", color: "bg-gray-100 text-gray-700" },
];

export default function IncidentReportPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Form state
  const [formType, setFormType] = useState("behavioral");
  const [formSeverity, setFormSeverity] = useState("medium");
  const [formYouthName, setFormYouthName] = useState("");
  const [formMrn, setFormMrn] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formFactors, setFormFactors] = useState("");
  const [formMedical, setFormMedical] = useState(false);
  const [formReportedBy, setFormReportedBy] = useState("");

  const { data: reports = [], isLoading } = trpc.groResidential.listIncidentReports.useQuery(
    filterStatus || filterSeverity ? { status: filterStatus || undefined, severity: filterSeverity || undefined } : undefined
  );

  const { data: detail } = trpc.groResidential.getIncidentReport.useQuery(
    { id: selectedId! }, { enabled: !!selectedId }
  );

  const { data: dashboard } = trpc.groResidential.incidentDashboard.useQuery();

  const createReport = trpc.groResidential.createIncidentReport.useMutation({
    onSuccess: () => {
      utils.groResidential.listIncidentReports.invalidate();
      utils.groResidential.incidentDashboard.invalidate();
      utils.groResidential.residentialDashboard.invalidate();
      toast.success("Incident report created");
      resetForm(); setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateReport = trpc.groResidential.updateIncidentReport.useMutation({
    onSuccess: () => { utils.groResidential.listIncidentReports.invalidate(); utils.groResidential.getIncidentReport.invalidate(); utils.groResidential.incidentDashboard.invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });

  const resolveReport = trpc.groResidential.resolveIncidentReport.useMutation({
    onSuccess: () => { utils.groResidential.listIncidentReports.invalidate(); utils.groResidential.getIncidentReport.invalidate(); utils.groResidential.incidentDashboard.invalidate(); toast.success("Incident resolved"); },
    onError: (e) => toast.error(e.message),
  });

  const closeReport = trpc.groResidential.closeIncidentReport.useMutation({
    onSuccess: () => { utils.groResidential.listIncidentReports.invalidate(); utils.groResidential.getIncidentReport.invalidate(); utils.groResidential.incidentDashboard.invalidate(); toast.success("Incident closed"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteReport = trpc.groResidential.deleteIncidentReport.useMutation({
    onSuccess: () => { utils.groResidential.listIncidentReports.invalidate(); utils.groResidential.incidentDashboard.invalidate(); toast.success("Deleted"); setShowDetail(false); setSelectedId(null); },
    onError: (e) => toast.error(e.message),
  });

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => { utils.groResidential.listIncidentReports.invalidate(); utils.groResidential.incidentDashboard.invalidate(); utils.groResidential.residentialDashboard.invalidate(); toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormType("behavioral"); setFormSeverity("medium"); setFormYouthName(""); setFormMrn("");
    setFormLocation(""); setFormDescription(""); setFormAction(""); setFormFactors("");
    setFormMedical(false); setFormReportedBy("");
  }

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.youthName?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.incidentNumber?.toLowerCase().includes(q);
  });

  const severityColor = (s: string) => SEVERITY_OPTIONS.find((o) => o.value === s)?.color ?? "bg-gray-100 text-gray-700";
  const statusColor = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "bg-gray-100 text-gray-700";

  return (
    <PageLayout category="Residential" title="Incident Reports" subtitle="Residential incident reporting and tracking">
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">

        {/* Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><FileWarning className="h-3.5 w-3.5" /> Total</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-gray-700">{dashboard?.total ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Open</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-700">{dashboard?.open ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Critical</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-800">{dashboard?.critical ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> High</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-700">{dashboard?.high ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Resolved</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-700">{dashboard?.resolved ?? 0}</div></CardContent>
          </Card>
        </div>

        {/* By type breakdown */}
        {dashboard?.byType && Object.keys(dashboard.byType).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Type</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dashboard.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">{type}: {count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Severities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Severities</SelectItem>
              {SEVERITY_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)} className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1.5" /> Report</Button>
          <Button variant="outline" size="icon" onClick={() => seedData.mutate()} disabled={seedData.isPending}>
            <RefreshCw className={cn("h-4 w-4", seedData.isPending && "animate-spin")} />
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed"><CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No incident reports found</p>
          </CardContent></Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Severity</TableHead>
                <TableHead className="text-xs">Youth</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs w-[60px]"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedId(r.id); setShowDetail(true); }}>
                    <TableCell className="text-xs font-mono font-medium">{r.incidentNumber}</TableCell>
                    <TableCell className="text-xs capitalize">{r.incidentType}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[10px]", severityColor(r.severity))}>{r.severity}</Badge></TableCell>
                    <TableCell className="text-xs">{r.youthName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.occurredLocation}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[10px]", statusColor(r.status))}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{r.occurredAt?.split("T")[0]}</TableCell>
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
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" />New Incident Report</DialogTitle>
              <DialogDescription>Report a residential incident. All reports are timestamped.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Incident Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INCIDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity *</Label>
                  <Select value={formSeverity} onValueChange={setFormSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Youth Name</Label><Input value={formYouthName} onChange={(e) => setFormYouthName(e.target.value)} placeholder="Resident name" /></div>
                <div><Label>MRN</Label><Input value={formMrn} onChange={(e) => setFormMrn(e.target.value)} placeholder="MRN" /></div>
              </div>
              <div>
                <Label>Location *</Label>
                <Input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Where did it occur?" />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Detailed description of the incident..." rows={4} />
              </div>
              <div>
                <Label>Immediate Action Taken</Label>
                <Textarea value={formAction} onChange={(e) => setFormAction(e.target.value)} placeholder="What was done immediately..." rows={2} />
              </div>
              <div>
                <Label>Contributing Factors</Label>
                <Input value={formFactors} onChange={(e) => setFormFactors(e.target.value)} placeholder="What led to the incident?" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="med-attn" checked={formMedical} onChange={(e) => setFormMedical(e.target.checked)} />
                <Label htmlFor="med-attn" className="text-sm font-normal cursor-pointer">Medical attention required</Label>
              </div>
              <div>
                <Label>Reported By *</Label>
                <Input value={formReportedBy} onChange={(e) => setFormReportedBy(e.target.value)} placeholder="Your name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createReport.mutate({
                  incidentType: formType as any,
                  severity: formSeverity as any,
                  youthName: formYouthName || undefined,
                  mrn: formMrn || undefined,
                  occurredAt: new Date().toISOString(),
                  occurredLocation: formLocation,
                  description: formDescription,
                  immediateAction: formAction || undefined,
                  factors: formFactors || undefined,
                  medicalAttentionRequired: formMedical,
                  reportedBy: formReportedBy,
                })}
                disabled={!formLocation || !formDescription || !formReportedBy || createReport.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {createReport.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={showDetail} onOpenChange={(o) => { if (!o) { setShowDetail(false); setSelectedId(null); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-red-600" />Incident {detail?.incidentNumber}</DialogTitle>
              <DialogDescription>{detail && `${detail.occurredAt?.split("T")[0]} · ${detail.occurredLocation}`}</DialogDescription>
            </DialogHeader>
            {detail && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="investigation">Investigation</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px]", severityColor(detail.severity))}>{detail.severity}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{detail.incidentType}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]", statusColor(detail.status))}>{detail.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-xs text-gray-500">Youth</span><div className="font-medium">{detail.youthName ?? "—"}</div></div>
                    <div><span className="text-xs text-gray-500">MRN</span><div className="font-mono">{detail.mrn ?? "—"}</div></div>
                    <div><span className="text-xs text-gray-500">Location</span><div>{detail.occurredLocation}</div></div>
                    <div><span className="text-xs text-gray-500">Time</span><div className="font-mono">{new Date(detail.occurredAt).toLocaleString()}</div></div>
                    <div><span className="text-xs text-gray-500">Reported By</span><div>{detail.reportedBy}</div></div>
                    {detail.witnesses && <div><span className="text-xs text-gray-500">Witnesses</span><div>{detail.witnesses}</div></div>}
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-gray-500">Description</Label>
                    <p className="text-sm mt-1 bg-gray-50 p-3 rounded">{detail.description}</p>
                  </div>
                  {detail.immediateAction && <div><Label className="text-xs text-gray-500">Immediate Action</Label><p className="text-sm mt-1 bg-blue-50 p-2 rounded">{detail.immediateAction}</p></div>}
                  {detail.factors && <div><Label className="text-xs text-gray-500">Contributing Factors</Label><p className="text-sm mt-1">{detail.factors}</p></div>}
                  {detail.medicalAttentionRequired && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                      <Stethoscope className="h-4 w-4" /> Medical attention was required
                    </div>
                  )}
                  {detail.youthInjuries && <div><Label className="text-xs text-red-600">Youth Injuries</Label><p className="text-sm mt-1 text-red-700">{detail.youthInjuries}</p></div>}
                  {detail.staffInjuries && <div><Label className="text-xs text-red-600">Staff Injuries</Label><p className="text-sm mt-1 text-red-700">{detail.staffInjuries}</p></div>}

                  {/* Actions */}
                  {detail.status === "open" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: detail.id, status: "under_review" })}>Under Review</Button>
                      <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: detail.id, status: "pending_supervisor" })}>Escalate</Button>
                    </div>
                  )}
                  {detail.status === "under_review" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => resolveReport.mutate({ id: detail.id, resolvedBy: "Supervisor" })}><CheckCircle2 className="h-4 w-4 mr-1" /> Resolve</Button>
                      <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: detail.id, status: "pending_supervisor" })}>Escalate</Button>
                    </div>
                  )}
                  {(detail.status === "resolved" || detail.status === "pending_supervisor") && (
                    <Button size="sm" variant="outline" onClick={() => closeReport.mutate({ id: detail.id, resolvedBy: "Supervisor" })}><Lock className="h-4 w-4 mr-1" /> Close</Button>
                  )}
                </TabsContent>
                <TabsContent value="investigation" className="space-y-4">
                  <div>
                    <Label>Investigator Assigned</Label>
                    <Input defaultValue={detail.investigatorAssigned ?? ""} onBlur={(e) => { if (e.target.value) updateReport.mutate({ id: detail.id, investigatorAssigned: e.target.value }); }} placeholder="Assign investigator..." />
                  </div>
                  <div>
                    <Label>Investigation Notes</Label>
                    <Textarea defaultValue={detail.investigationNotes ?? ""} onBlur={(e) => { if (e.target.value) updateReport.mutate({ id: detail.id, investigationNotes: e.target.value }); }} placeholder="Investigation findings..." rows={4} />
                  </div>
                  <div>
                    <Label>Root Cause</Label>
                    <Input defaultValue={detail.rootCause ?? ""} onBlur={(e) => { if (e.target.value) updateReport.mutate({ id: detail.id, rootCause: e.target.value }); }} placeholder="Root cause analysis..." />
                  </div>
                  <div>
                    <Label>Corrective Actions</Label>
                    <Textarea defaultValue={detail.correctiveActions ?? ""} onBlur={(e) => { if (e.target.value) updateReport.mutate({ id: detail.id, correctiveActions: e.target.value }); }} placeholder="Corrective actions taken..." rows={3} />
                  </div>
                  {detail.supervisionNotes && detail.supervisionNotes.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500">Related Supervision Notes ({detail.supervisionNotes.length})</Label>
                      {detail.supervisionNotes.map((sn) => (
                        <div key={sn.id} className="text-xs p-2 border rounded mt-1"><span className="font-medium">{sn.supervisionType}</span> — {sn.topicsDiscussed?.substring(0, 80)}...</div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="notifications" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-500" /><span className="text-sm">Guardian Notified</span></div>
                      {detail.guardianNotified ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" />Yes</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: detail.id, guardianNotified: true, guardianNotifiedBy: "Staff" })}>Mark Notified</Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-gray-500" /><span className="text-sm">Supervisor Notified</span></div>
                      {detail.supervisorNotified ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" />Yes</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => updateReport.mutate({ id: detail.id, supervisorNotified: true, supervisorNotifiedBy: "Staff" })}>Mark Notified</Button>
                      )}
                    </div>
                  </div>
                  {detail.resolvedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-700 text-sm font-medium"><CheckCircle2 className="h-4 w-4" />Resolved</div>
                      <p className="text-xs text-green-600 mt-1">By {detail.resolvedBy} on {new Date(detail.resolvedAt).toLocaleString()}</p>
                      {detail.resolutionNotes && <p className="text-xs text-green-600 mt-1">{detail.resolutionNotes}</p>}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete this incident report?")) deleteReport.mutate({ id: selectedId! }); }}>
                <XCircle className="h-4 w-4 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
