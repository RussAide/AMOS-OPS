import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, ShieldCheck, PenLine, Eye, ChevronRight, Search, Layers } from "lucide-react";

const BINDER_AREAS = [
  { id: "00_Master_Control", label: "00 - Master Control" },
  { id: "01_Recruitment", label: "01 - Recruitment" },
  { id: "02_Conditional_Offer", label: "02 - Conditional Offer" },
  { id: "03_Pre_Employment_Clearance", label: "03 - Pre-Employment Clearance" },
  { id: "04_Screening_Clearance", label: "04 - Screening Clearance" },
  { id: "05_Final_Agreement_Clearance", label: "05 - Final Agreement Clearance" },
  { id: "06_Orientation", label: "06 - Orientation" },
  { id: "07_Training", label: "07 - Training" },
  { id: "08_GRO_Assignment", label: "08 - GRO Assignment" },
  { id: "09_Benefits_Enrollment", label: "09 - Benefits Enrollment" },
  { id: "10_Performance", label: "10 - Performance" },
  { id: "11_Separation", label: "11 - Separation" },
  { id: "12_Grievance_Compliance", label: "12 - Grievance & Compliance" },
  { id: "13_File_Management", label: "13 - File Management" },
  { id: "14_Audit_Logs", label: "14 - Audit Logs" },
];

export function HRFormRegistry() {
  const [open, setOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState("all");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: templates = [] } = trpc.forms.listTemplates.useQuery(
    selectedArea !== "all" ? { binderArea: selectedArea } : undefined,
    { enabled: open }
  );

  const { data: detailTemplate } = trpc.forms.getTemplate.useQuery(
    { id: detailId! },
    { enabled: !!detailId }
  );

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.formCode.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const grouped = BINDER_AREAS.map((area) => ({
    area,
    forms: filtered.filter((t) => t.binderArea === area.id),
  })).filter((g) => g.forms.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#245C5A30", backgroundColor: "#F0FDFA08" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Form Registry</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#245C5A" }}>{templates.length}</p>
            </div>
            <Layers size={20} style={{ color: "#245C5A" }} />
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <FileText size={18} />
            Form Template Registry
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search form name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 text-[12px] h-8"
            />
          </div>
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="h-8 text-[12px] w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Binder Areas</SelectItem>
              {BINDER_AREAS.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-[12px]">{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Form count */}
        <p className="text-[10px] text-muted-foreground mb-2">
          {filtered.length} form{filtered.length !== 1 ? "s" : ""} found
          {search ? ` matching "${search}"` : ""}
        </p>

        {/* Detail view */}
        {detailId && detailTemplate ? (
          <div className="mb-3 border rounded-lg p-4" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                    {detailTemplate.formCode}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {BINDER_AREAS.find((a) => a.id === detailTemplate.binderArea)?.label || detailTemplate.binderArea}
                  </span>
                </div>
                <h3 className="text-[14px] font-bold mt-1" style={{ color: "var(--topbar-title)" }}>
                  {detailTemplate.name}
                </h3>
              </div>
              <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={() => setDetailId(null)}>
                Back to list
              </Button>
            </div>

            {detailTemplate.description && (
              <p className="text-[11px] text-muted-foreground mb-3">{detailTemplate.description}</p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded bg-gray-50 text-center">
                <p className="text-[10px] text-muted-foreground">Output</p>
                <p className="text-[12px] font-semibold uppercase">{detailTemplate.outputFormat}</p>
              </div>
              <div className="p-2 rounded bg-gray-50 text-center">
                <p className="text-[10px] text-muted-foreground">Fields</p>
                <p className="text-[12px] font-semibold">{detailTemplate.fields?.length || 0}</p>
              </div>
              <div className="p-2 rounded bg-gray-50 text-center">
                <p className="text-[10px] text-muted-foreground">Role Bindings</p>
                <p className="text-[12px] font-semibold">{detailTemplate.bindings?.length || 0}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              {detailTemplate.signatureRequired && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#059669" }}>
                  <PenLine size={11} /> Signature Required
                </span>
              )}
              {detailTemplate.reviewerRequired && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#7C3AED" }}>
                  <Eye size={11} /> Reviewer Required
                </span>
              )}
              {detailTemplate.requiredForGate && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#D97706" }}>
                  <ShieldCheck size={11} /> Gate Required
                </span>
              )}
            </div>

            {/* Fields */}
            {detailTemplate.fields && detailTemplate.fields.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Form Fields</p>
                <div className="space-y-1">
                  {detailTemplate.fields.map((f: Record<string, unknown>) => (
                    <div key={String(f.id)} className="flex items-center gap-2 p-1.5 rounded bg-gray-50">
                      <span className="text-[10px] font-medium flex-1">{String(f.label)}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white text-gray-500 font-medium">
                        {String(f.fieldType)}
                      </span>
                      {f.required ? (
                        <span className="text-[8px]" style={{ color: "#DC2626" }}>*req</span>
                      ) : (
                        <span className="text-[8px] text-gray-400">opt</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role bindings */}
            {detailTemplate.bindings && detailTemplate.bindings.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Auto-Assignment Rules</p>
                <div className="space-y-1">
                  {detailTemplate.bindings.map((b: Record<string, unknown>) => (
                    <div key={String(b.id)} className="flex items-center gap-2 p-1.5 rounded bg-gray-50 text-[10px]">
                      <span className="font-medium">{String(b.role)}</span>
                      <span className="text-muted-foreground">
                        {b.isRequired ? "Required" : "Optional"} ·
                        {b.isAutoAssigned ? " Auto" : " Manual"}
                      </span>
                      <span className="text-muted-foreground ml-auto">{String(b.assignmentTrigger)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Grouped list */
          <div className="space-y-4">
            {grouped.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {templates.length === 0
                  ? "No form templates registered yet. Use the seed script to populate the registry."
                  : "No forms match your search."}
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.area.id}>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <ChevronRight size={10} />
                    {group.area.label}
                    <span className="text-[9px] font-normal">({group.forms.length})</span>
                  </h4>
                  <div className="space-y-0.5">
                    {group.forms.map((form) => (
                      <button
                        key={form.id}
                        onClick={() => setDetailId(form.id)}
                        className="w-full flex items-center gap-2 p-2 rounded-md text-left transition-all hover:bg-gray-50"
                      >
                        <FileText size={13} style={{ color: "#245C5A" }} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium truncate">{form.name}</span>
                            <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                              {form.formCode}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
