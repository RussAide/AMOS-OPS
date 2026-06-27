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
import { Textarea } from "@/components/ui/textarea";
import { Eye, CheckCircle, RotateCcw } from "lucide-react";

export function FormReviewQueue() {
  const [open, setOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const { data: instances = [] } = trpc.forms.listInstances.useQuery(
    undefined,
    { enabled: open }
  );

  const { data: templates = [] } = trpc.forms.listTemplates.useQuery(
    undefined,
    { enabled: open }
  );

  const updateMutation = trpc.forms.updateInstanceStatus.useMutation();
  const utils = trpc.useUtils();

  const handleApprove = async (id: string) => {
    await updateMutation.mutateAsync({ id, status: "approved" });
    utils.forms.listInstances.invalidate();
  };

  const handleReturn = async (id: string) => {
    await updateMutation.mutateAsync({
      id,
      status: "returned-for-correction",
      returnedReason: returnReason || undefined,
    });
    setReturnReason("");
    setSelectedInstanceId(null);
    utils.forms.listInstances.invalidate();
  };

  const handleLock = async (id: string) => {
    await updateMutation.mutateAsync({ id, status: "locked" });
    utils.forms.listInstances.invalidate();
  };

  // Filter for reviewable instances
  const reviewable = instances.filter((i) =>
    ["submitted", "under-review", "returned-for-correction"].includes(i.status)
  );

  const pendingCount = instances.filter((i) => i.status === "submitted").length;
  const underReviewCount = instances.filter((i) => i.status === "under-review").length;
  const returnedCount = instances.filter((i) => i.status === "returned-for-correction").length;

  const getTemplateName = (tid: string) => {
    const t = templates.find((x) => x.id === tid);
    return t ? `${t.formCode} - ${t.name}` : tid.slice(0, 8);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#245C5A30", backgroundColor: "#F0FDFA08" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Review Queue</p>
              <p className="text-2xl font-bold mt-1" style={{ color: pendingCount > 0 ? "#D97706" : "#245C5A" }}>
                {reviewable.length}
              </p>
            </div>
            <Eye size={20} style={{ color: pendingCount > 0 ? "#D97706" : "#245C5A" }} />
          </div>
          {pendingCount > 0 && (
            <p className="text-[9px] mt-1" style={{ color: "#D97706" }}>{pendingCount} awaiting review</p>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <Eye size={18} />
            Form Review Queue
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Submitted", value: pendingCount, color: "#D97706", bg: "#FFFBEB" },
            { label: "Under Review", value: underReviewCount, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Returned", value: returnedCount, color: "#DC2626", bg: "#FEF2F2" },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 rounded-md" style={{ backgroundColor: s.bg }}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] font-medium uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {reviewable.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle size={32} className="mx-auto mb-2" style={{ color: "#059669" }} />
            <p className="text-[13px] font-medium">All caught up!</p>
            <p className="text-[11px]">No forms awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reviewable.map((inst) => {
              const isSelected = selectedInstanceId === inst.id;
              return (
                <div key={inst.id} className="border rounded-lg p-3" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
                        backgroundColor: inst.status === "submitted" ? "#FFFBEB" : inst.status === "under-review" ? "#EFF6FF" : "#FEF2F2",
                        color: inst.status === "submitted" ? "#D97706" : inst.status === "under-review" ? "#2563EB" : "#DC2626",
                      }}>
                        {inst.status === "submitted" ? "Submitted" : inst.status === "under-review" ? "Under Review" : "Returned"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {inst.submittedAt?.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {getTemplateName(inst.templateId)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Person: {inst.personId.slice(0, 8)}... · Submitted by: {inst.submittedByUserId || "Unknown"}
                  </p>

                  {/* Returned reason display */}
                  {inst.returnedReason && (
                    <div className="mt-1.5 p-1.5 rounded bg-red-50 text-[10px]" style={{ color: "#DC2626" }}>
                      Return reason: {inst.returnedReason}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {inst.status === "submitted" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[9px] h-6 px-2 gap-1"
                        onClick={() => handleApprove(inst.id)}
                      >
                        <CheckCircle size={10} /> Approve
                      </Button>
                    )}
                    {inst.status === "submitted" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[9px] h-6 px-2 gap-1"
                        style={{ color: "#2563EB", borderColor: "#2563EB" }}
                        onClick={() => { setSelectedInstanceId(inst.id); }}
                      >
                        <RotateCcw size={10} /> Return
                      </Button>
                    )}
                    {inst.status === "under-review" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[9px] h-6 px-2 gap-1"
                        onClick={() => handleLock(inst.id)}
                      >
                        <CheckCircle size={10} /> Lock
                      </Button>
                    )}
                    {inst.status === "returned-for-correction" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[9px] h-6 px-2 gap-1"
                        style={{ color: "#059669" }}
                        onClick={() => handleApprove(inst.id)}
                      >
                        <CheckCircle size={10} /> Re-approve
                      </Button>
                    )}
                  </div>

                  {/* Return reason input */}
                  {isSelected && inst.status === "submitted" && (
                    <div className="mt-2 p-2 rounded border" style={{ borderColor: "#FECACA" }}>
                      <Textarea
                        placeholder="Enter reason for returning this form..."
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="text-[11px] min-h-[60px] mb-2"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="text-[9px] h-6"
                          style={{ backgroundColor: "#DC2626" }}
                          onClick={() => handleReturn(inst.id)}
                        >
                          Return to Sender
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[9px] h-6"
                          onClick={() => { setSelectedInstanceId(null); setReturnReason(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
