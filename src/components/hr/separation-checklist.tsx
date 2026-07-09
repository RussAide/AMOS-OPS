import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, CheckCircle2, LogOut } from "lucide-react";

const CHECKLIST_DEF = [
  { id: "exit-interview", label: "Exit Interview Conducted", category: "HR" },
  { id: "equipment", label: "Equipment Returned (laptop, phone, keys)", category: "IT" },
  { id: "access-cards", label: "Access Cards / Badges Returned", category: "Security" },
  { id: "email-deactivated", label: "Email & System Accounts Deactivated", category: "IT" },
  { id: "final-paycheck", label: "Final Paycheck Processed", category: "Payroll" },
  { id: "benefits-term", label: "Benefits Termination Submitted", category: "HR" },
  { id: "cobra-notice", label: "COBRA Notice Sent", category: "HR" },
  { id: "reference-letter", label: "Reference Letter Provided (if eligible)", category: "HR" },
  { id: "file-archived", label: "Personnel File Archived", category: "HR" },
  { id: "turnover-doc", label: "Turnover Documentation Complete", category: "Supervisor" },
];

interface ChecklistState {
  completed: boolean;
  completedAt: string;
  completedBy: string;
  notes: string;
}

interface Props {
  personId: string;
  personName: string;
}

export function SeparationChecklist({ personId, personName }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: dbItems = [] } = trpc.separation.getByPerson.useQuery(
    { personId },
    { enabled: open }
  );
  const upsertMutation = trpc.separation.upsertItem.useMutation();
  const bulkMutation = trpc.separation.bulkUpsert.useMutation();
  const utils = trpc.useUtils();

  // Build local state from DB + defaults
  const [localItems, setLocalItems] = useState<Record<string, ChecklistState>>({});

  // Sync DB items to local state when dialog opens
  useMemo(() => {
    const init: Record<string, ChecklistState> = {};
    for (const def of CHECKLIST_DEF) {
      const dbItem = dbItems.find((d) => d.itemId === def.id);
      init[def.id] = {
        completed: dbItem?.completed ?? false,
        completedAt: dbItem?.completedAt ?? "",
        completedBy: dbItem?.completedBy ?? "",
        notes: dbItem?.notes ?? "",
      };
    }
    setLocalItems(init);
  }, [dbItems, open]);

  const toggleItem = useCallback((id: string) => {
    setLocalItems((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const nowCompleted = !item.completed;
      return {
        ...prev,
        [id]: {
          ...item,
          completed: nowCompleted,
          completedAt: nowCompleted ? new Date().toISOString().slice(0, 10) : "",
        },
      };
    });
  }, []);

  const updateItem = useCallback((id: string, field: "completedBy" | "notes", value: string) => {
    setLocalItems((prev) => {
      const item = prev[id];
      if (!item) return prev;
      return { ...prev, [id]: { ...item, [field]: value } };
    });
  }, []);

  const completedCount = useMemo(
    () => Object.values(localItems).filter((i) => i.completed).length,
    [localItems]
  );
  const percent = CHECKLIST_DEF.length > 0 ? Math.round((completedCount / CHECKLIST_DEF.length) * 100) : 0;

  const handleSave = async () => {
    const payload = CHECKLIST_DEF.map((def) => ({
      personId,
      itemId: def.id,
      label: def.label,
      category: def.category,
      completed: localItems[def.id]?.completed ?? false,
      completedBy: localItems[def.id]?.completedBy || undefined,
      completedAt: localItems[def.id]?.completedAt || undefined,
      notes: localItems[def.id]?.notes || undefined,
    }));

    try {
      await bulkMutation.mutateAsync(payload);
      utils.separation.getByPerson.invalidate({ personId });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 1200);
    } catch (err) {
      console.error("Failed to save checklist:", err);
    }
  };

  const handleToggleAndSave = async (id: string) => {
    toggleItem(id);
    // Toggle the item in local state first, then get the new state
    const item = localItems[id];
    if (!item) return;
    const nowCompleted = !item.completed;
    const def = CHECKLIST_DEF.find((d) => d.id === id);
    if (!def) return;

    try {
      await upsertMutation.mutateAsync({
        personId,
        itemId: id,
        label: def.label,
        category: def.category,
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date().toISOString().slice(0, 10) : undefined,
        completedBy: nowCompleted ? (item.completedBy || "Current User") : undefined,
      });
      utils.separation.getByPerson.invalidate({ personId });
    } catch (err) {
      console.error("Failed to toggle item:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-xs">
          <LogOut size={13} />
          Offboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <LogOut size={16} />
            Separation Checklist: {personName}
          </DialogTitle>
        </DialogHeader>

        {saved ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} style={{ color: "#059669" }} />
            </div>
            <p className="font-semibold text-green-700">Checklist Saved</p>
            <p className="text-xs text-muted-foreground mt-1">
              {percent === 100 ? "All items complete - offboarding finished." : `${completedCount}/${CHECKLIST_DEF.length} items recorded.`}
            </p>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Progress</span>
                <span className="text-[11px] font-semibold" style={{ color: percent === 100 ? "#059669" : "#D97706" }}>
                  {completedCount}/{CHECKLIST_DEF.length} ({percent}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percent}%`, backgroundColor: percent === 100 ? "#059669" : "#D97706" }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {CHECKLIST_DEF.map((item) => {
                const state = localItems[item.id] || { completed: false, completedAt: "", completedBy: "", notes: "" };
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-md border transition-all ${state.completed ? "bg-green-50/50 border-green-200" : "bg-white border-gray-200"}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => handleToggleAndSave(item.id)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${state.completed ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-[#245C5A]"}`}
                      >
                        {state.completed && <Check size={12} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium ${state.completed ? "line-through text-gray-400" : ""}`}>
                            {item.label}
                          </span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{item.category}</span>
                        </div>
                        {state.completed && (
                          <>
                            <div className="mt-1.5 flex items-center gap-2">
                              <Input
                                placeholder="Completed by"
                                value={state.completedBy}
                                onChange={(e) => updateItem(item.id, "completedBy", e.target.value)}
                                className="h-6 text-[10px] w-[100px]"
                              />
                              <span className="text-[9px] text-muted-foreground">{state.completedAt}</span>
                            </div>
                            <Textarea
                              placeholder="Notes (optional)"
                              value={state.notes}
                              onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                              className="h-8 text-[10px] mt-1 min-h-0"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                style={{ backgroundColor: percent === 100 ? "#059669" : "#245C5A" }}
                onClick={handleSave}
                disabled={bulkMutation.isPending}
              >
                {bulkMutation.isPending ? "Saving..." : percent === 100 ? "Complete Offboarding" : "Save Progress"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
