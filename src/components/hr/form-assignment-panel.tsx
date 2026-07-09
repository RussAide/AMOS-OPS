import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
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
import type { ReactNode } from "react";
import { FilePlus, CheckCircle, Clock, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  personId: string;
  personRole: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F3F4F6", color: "#6B7280", label: "Draft" },
  assigned: { bg: "#F0FDFA", color: "#245C5A", label: "Assigned" },
  "in-progress": { bg: "#EFF6FF", color: "#2563EB", label: "In Progress" },
  submitted: { bg: "#FFFBEB", color: "#D97706", label: "Submitted" },
  "under-review": { bg: "#FEF3C7", color: "#B45309", label: "Under Review" },
  "returned-for-correction": { bg: "#FEE2E2", color: "#DC2626", label: "Returned" },
  approved: { bg: "#ECFDF5", color: "#059669", label: "Approved" },
  locked: { bg: "#F0FDFA", color: "#059669", label: "Locked" },
  "filed-to-dms": { bg: "#F3E8FF", color: "#7C3AED", label: "Filed" },
  expired: { bg: "#FEE2E2", color: "#991B1B", label: "Expired" },
  waived: { bg: "#F3F4F6", color: "#9CA3AF", label: "Waived" },
  superseded: { bg: "#F3F4F6", color: "#9CA3AF", label: "Superseded" },
};

export function FormAssignmentPanel({ personId, personRole }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: instances = [] } = trpc.forms.listInstances.useQuery(
    { personId },
    { enabled: open }
  );

  const { data: templates = [] } = trpc.forms.listTemplates.useQuery(
    { isActive: true },
    { enabled: open }
  );

  const createMutation = trpc.forms.createInstance.useMutation();
  const updateMutation = trpc.forms.updateInstanceStatus.useMutation();
  const autoAssignMutation = trpc.forms.autoAssign.useMutation();
  const utils = trpc.useUtils();

  const handleAssign = async () => {
    if (!selectedTemplateId) return;
    await createMutation.mutateAsync({
      templateId: selectedTemplateId,
      personId,
    });
    utils.forms.listInstances.invalidate({ personId });
    setSelectedTemplateId("");
  };

  const handleAutoAssign = async () => {
    await autoAssignMutation.mutateAsync({ personId, role: personRole });
    utils.forms.listInstances.invalidate({ personId });
  };

  const handleStatusChange = async (instanceId: string, status: string) => {
    await updateMutation.mutateAsync({
      id: instanceId,
      status: status as any,
    });
    utils.forms.listInstances.invalidate({ personId });
  };

  // Group by status category
  const pending = instances.filter((i) => ["assigned", "in-progress"].includes(i.status));
  const review = instances.filter((i) => ["submitted", "under-review", "returned-for-correction"].includes(i.status));
  const complete = instances.filter((i) => ["approved", "locked", "filed-to-dms"].includes(i.status));
  const other = instances.filter((i) => !["assigned", "in-progress", "submitted", "under-review", "returned-for-correction", "approved", "locked", "filed-to-dms"].includes(i.status));

  const completionRate = instances.length > 0
    ? Math.round((complete.length / instances.length) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#245C5A30", backgroundColor: "#F0FDFA08" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Assigned Forms</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#245C5A" }}>{instances.length}</p>
            </div>
            <FilePlus size={20} style={{ color: "#245C5A" }} />
          </div>
          {instances.length > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${completionRate}%`, backgroundColor: "#245C5A" }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{completionRate}%</span>
              </div>
              {pending.length > 0 && (
                <p className="text-[9px] mt-0.5" style={{ color: "#D97706" }}>{pending.length} pending</p>
              )}
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <FilePlus size={18} />
            Form Assignments
          </DialogTitle>
        </DialogHeader>

        {/* Assignment toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="h-8 text-[12px] flex-1">
              <SelectValue placeholder="Select form template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-[12px]">
                  {t.formCode} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="text-[11px] h-8"
            style={{ backgroundColor: "#245C5A" }}
            onClick={handleAssign}
            disabled={!selectedTemplateId || createMutation.isPending}
          >
            Assign
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-8"
            onClick={handleAutoAssign}
            disabled={autoAssignMutation.isPending}
          >
            Auto
          </Button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FilePlus size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">No forms assigned yet.</p>
            <p className="text-[11px]">Select a template above or click "Auto" to auto-assign based on role.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock size={10} /> Pending ({pending.length})
                </h4>
                {pending.map((inst) => renderInstance(inst, handleStatusChange))}
              </div>
            )}

            {/* Under Review */}
            {review.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> Under Review ({review.length})
                </h4>
                {review.map((inst) => renderInstance(inst, handleStatusChange))}
              </div>
            )}

            {/* Complete */}
            {complete.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <CheckCircle size={10} /> Complete ({complete.length})
                </h4>
                {complete.map((inst) => renderInstance(inst, handleStatusChange))}
              </div>
            )}

            {/* Other */}
            {other.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> Other ({other.length})
                </h4>
                {other.map((inst) => renderInstance(inst, handleStatusChange))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function renderInstance(
  inst: Record<string, unknown>,
  onStatusChange: (id: string, status: string) => void
): ReactNode {
  const style = STATUS_COLORS[String(inst.status)] || { bg: "#F3F4F6", color: "#6B7280", label: String(inst.status) };
  const isPending = ["assigned", "in-progress"].includes(String(inst.status));

  return (
    <div key={String(inst.id)} className="flex items-center gap-2 p-2 rounded-md border" style={{ borderColor: `${style.color}20`, backgroundColor: style.bg }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: style.color + "15", color: style.color }}>
            {style.label}
          </span>
          {(inst.dueDate as string | null | undefined) && (
            <span className="text-[9px] text-muted-foreground">
              Due: {String(inst.dueDate)}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: "var(--topbar-title)" }}>
          Template: {String(inst.templateId).slice(0, 8)}...
        </p>
      </div>
      {isPending && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] h-6 px-2"
            onClick={() => onStatusChange(String(inst.id), "in-progress")}
          >
            Start
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] h-6 px-2"
            style={{ color: "#059669" }}
            onClick={() => onStatusChange(String(inst.id), "submitted")}
          >
            Submit
          </Button>
        </div>
      )}
      {String(inst.status) === "submitted" && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] h-6 px-2"
            onClick={() => onStatusChange(String(inst.id), "under-review")}
          >
            Review
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] h-6 px-2"
            style={{ color: "#059669" }}
            onClick={() => onStatusChange(String(inst.id), "approved")}
          >
            Approve
          </Button>
        </div>
      )}
      <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
    </div>
  );
}
