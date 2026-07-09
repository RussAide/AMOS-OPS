import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/shell/page-layout";
import { WorkTaskFilters } from "@/components/workflows/work-task-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Send,
  UserCog,
  AlertOctagon,
  MessageSquare,
  Upload,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
  LayoutList,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */

interface WorkTask {
  id: string;
  task_title: string;
  task_type: string;
  assigned_to: string;
  priority: string;
  status: string;
  entity_type: string;
  entity_id: string;
  evidence_required: number;
  due_date: string;
}

interface EvidenceItem {
  id: string;
  name: string;
  required: boolean;
  status: "complete" | "pending";
}

interface WorkflowGroup {
  code: string;
  name: string;
  icon: typeof ClipboardList;
  tasks: EnrichedTask[];
}

interface EnrichedTask extends WorkTask {
  workflowCode: string;
  workflowName: string;
  evidenceItems: EvidenceItem[];
  isOverdue: boolean;
}

/* ─── Workflow Definitions ──────────────────────────────── */

const WORKFLOW_DEFS: Record<string, { code: string; name: string; icon: typeof ClipboardList }> = {
  onboarding: { code: "WF-001", name: "Referral Intake", icon: ClipboardList },
  "credential-check": { code: "WF-002", name: "Clinical Assessment", icon: CheckCircle2 },
  renewal: { code: "WF-003", name: "Service Delivery", icon: Clock },
  "packet-assembly": { code: "WF-004", name: "GRO Shift Ops", icon: Inbox },
  review: { code: "WF-005", name: "Incident Reporting", icon: AlertTriangle },
  training: { code: "WF-006", name: "CAP/Audit Readiness", icon: UserCheck },
  incident: { code: "WF-007", name: "Billing Gate", icon: AlertOctagon },
  "evidence-packet": { code: "WF-008", name: "Executive Decision Routing", icon: Send },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  urgent: { bg: "#FEF2F2", text: "#DC2626", border: "#fca5a5" },
  high: { bg: "#FFF7ED", text: "#C2410C", border: "#fdba74" },
  medium: { bg: "#FFFBEB", text: "#B45309", border: "#fcd34d" },
  low: { bg: "#F0FDF4", text: "#059669", border: "#86efac" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#FFFBEB", text: "#B45309" },
  "in-progress": { bg: "#EFF6FF", text: "#2563EB" },
  completed: { bg: "#ECFDF5", text: "#059669" },
  overdue: { bg: "#FEF2F2", text: "#DC2626" },
};

/* ─── Evidence Generator ────────────────────────────────── */

function generateEvidenceItems(task: WorkTask): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (task.entity_type === "onboarding") {
    items.push(
      { id: `${task.id}-ev1`, name: "Background Check Clearance", required: true, status: "complete" },
      { id: `${task.id}-ev2`, name: "I-9 Verification", required: true, status: "pending" },
      { id: `${task.id}-ev3`, name: "Orientation Sign-off", required: true, status: "pending" },
      { id: `${task.id}-ev4`, name: "Policy Acknowledgment", required: true, status: "pending" },
      { id: `${task.id}-ev5`, name: "Emergency Contact Form", required: false, status: "pending" },
    );
  } else if (task.entity_type === "credential") {
    items.push(
      { id: `${task.id}-ev1`, name: "Current License/Cert Copy", required: true, status: task.status === "in-progress" ? "complete" : "pending" },
      { id: `${task.id}-ev2`, name: "Verification from Issuing Board", required: true, status: "pending" },
      { id: `${task.id}-ev3`, name: "CEU Documentation", required: task.task_type === "renewal", status: "pending" },
    );
  } else if (task.entity_type === "evidence-packet") {
    items.push(
      { id: `${task.id}-ev1`, name: "Supporting Documents", required: true, status: "complete" },
      { id: `${task.id}-ev2`, name: "Supervisor Sign-off", required: true, status: "pending" },
      { id: `${task.id}-ev3`, name: "QA Review Stamp", required: true, status: "pending" },
    );
  } else {
    items.push(
      { id: `${task.id}-ev1`, name: "Primary Documentation", required: true, status: task.evidence_required > 0 && task.status === "in-progress" ? "complete" : "pending" },
      { id: `${task.id}-ev2`, name: "Secondary Review", required: false, status: "pending" },
    );
  }
  return items;
}

/* ─── Component ─────────────────────────────────────────── */

export function MyWorkTodayPage() {
  const [filteredTasks, setFilteredTasks] = useState<EnrichedTask[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    type: "complete" | "reassign" | "escalate" | "comment" | null;
    taskId: string | null;
  }>({ type: null, taskId: null });

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [reassignee, setReassignee] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  /* ─── tRPC Hooks ─── */
  const utils = trpc.useUtils();
  const { data: rawTasks, isLoading, error } = trpc.m1.getWorkQueue.useQuery();

  const claimMutation = trpc.m1.claimWorkTask.useMutation({
    onSuccess: () => utils.m1.getWorkQueue.invalidate(),
  });
  const completeMutation = trpc.m1.completeWorkTask.useMutation({
    onSuccess: () => {
      utils.m1.getWorkQueue.invalidate();
      closeDialog();
    },
  });
  const reassignMutation = trpc.m1.reassignWorkTask.useMutation({
    onSuccess: () => {
      utils.m1.getWorkQueue.invalidate();
      closeDialog();
    },
  });
  const escalateMutation = trpc.m1.escalateWorkTask.useMutation({
    onSuccess: () => {
      utils.m1.getWorkQueue.invalidate();
      closeDialog();
    },
  });
  const commentMutation = trpc.m1.addWorkTaskComment.useMutation({
    onSuccess: () => {
      utils.m1.getWorkQueue.invalidate();
      closeDialog();
    },
  });

  /* ─── Derived State ─── */
  const enrichedTasks: EnrichedTask[] = useMemo(() => {
    if (!rawTasks) return [];
    const now = new Date();
    return (rawTasks as WorkTask[]).map((t) => {
      const wfDef = WORKFLOW_DEFS[t.task_type] || { code: "WF-000", name: "General", icon: ClipboardList };
      const dueDate = new Date(t.due_date);
      const isOverdue = dueDate < now && t.status !== "completed";
      return {
        ...t,
        workflowCode: wfDef.code,
        workflowName: wfDef.name,
        evidenceItems: generateEvidenceItems(t),
        isOverdue,
      };
    });
  }, [rawTasks]);

  /* Initialize filtered tasks when data loads */
  useMemo(() => {
    if (enrichedTasks.length > 0 && filteredTasks.length === 0 && !rawTasks) {
      setFilteredTasks(enrichedTasks);
    }
  }, [enrichedTasks, filteredTasks.length, rawTasks]);

  /* ─── Stats (computed from ALL tasks, not filtered) ─── */
  const overdueCount = enrichedTasks.filter((t) => t.isOverdue).length;
  const pendingCount = enrichedTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = enrichedTasks.filter((t) => t.status === "in-progress").length;

  /* ─── Grouped Tasks (computed from FILTERED tasks) ─── */
  const groupedTasks = useMemo(() => {
    const groups: Record<string, WorkflowGroup> = {};
    for (const task of filteredTasks) {
      if (!groups[task.workflowCode]) {
        groups[task.workflowCode] = {
          code: task.workflowCode,
          name: task.workflowName,
          icon: (WORKFLOW_DEFS[task.task_type]?.icon || ClipboardList),
          tasks: [],
        };
      }
      groups[task.workflowCode].tasks.push(task);
    }
    return Object.values(groups).sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredTasks]);

  /* ─── Handlers ─── */
  const handleFilterChange = useCallback((filtered: EnrichedTask[]) => {
    setFilteredTasks(filtered);
  }, []);

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTask((prev) => (prev === taskId ? null : taskId));
  }, []);

  const openDialog = useCallback((type: "complete" | "reassign" | "escalate" | "comment", taskId: string) => {
    setDialogState({ type, taskId });
    setFile(null);
    setReassignee("");
    setReason("");
    setComment("");
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState({ type: null, taskId: null });
    setFile(null);
    setReassignee("");
    setReason("");
    setComment("");
  }, []);

  const handleClaim = (taskId: string) => claimMutation.mutate({ taskId });
  const handleComplete = () => {
    if (!dialogState.taskId) return;
    completeMutation.mutate({ taskId: dialogState.taskId, fileName: file?.name });
  };
  const handleReassign = () => {
    if (!dialogState.taskId || !reassignee) return;
    reassignMutation.mutate({ taskId: dialogState.taskId, newAssignee: reassignee, reason });
  };
  const handleEscalate = () => {
    if (!dialogState.taskId || !reason) return;
    escalateMutation.mutate({ taskId: dialogState.taskId, reason });
  };
  const handleComment = () => {
    if (!dialogState.taskId || !comment) return;
    commentMutation.mutate({ taskId: dialogState.taskId, comment });
  };

  /* ─── Loading / Error ─── */
  if (isLoading) {
    return (
      <PageLayout>
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin" style={{ color: "#245C5A" }} />
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Loading your work queue...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="px-4 md:px-6 pb-8">
          <div className="rounded-lg border p-6" style={{ backgroundColor: "#FEF2F2", borderColor: "#fca5a5" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon size={18} style={{ color: "#DC2626" }} />
              <span className="text-[14px] font-semibold" style={{ color: "#DC2626" }}>Error loading work queue</span>
            </div>
            <p className="text-[12px]" style={{ color: "#991B1B" }}>{error.message}</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  /* ─── Render ─── */
  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">
        {/* ─── Header ─── */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <ClipboardList size={22} style={{ color: "#245C5A" }} />
            My Work Today
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Manage your assigned tasks, evidence checklists, and daily workflow actions
          </p>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Inbox size={14} style={{ color: "#245C5A" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Total Tasks</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: "#245C5A" }}>{enrichedTasks.length}</div>
          </div>
          <div className="rounded-lg border p-3" style={{ backgroundColor: overdueCount > 0 ? "#FEF2F2" : "var(--card-bg)", borderColor: overdueCount > 0 ? "#fca5a5" : "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} style={{ color: overdueCount > 0 ? "#DC2626" : "#059669" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Overdue</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: overdueCount > 0 ? "#DC2626" : "#059669" }}>{overdueCount}</div>
          </div>
          <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} style={{ color: "#B45309" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Pending</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: "#B45309" }}>{pendingCount}</div>
          </div>
          <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={14} style={{ color: "#2563EB" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>In Progress</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: "#2563EB" }}>{inProgressCount}</div>
          </div>
        </div>

        {/* ─── Main Content: Filters + Task List ─── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Panel - Sidebar on desktop, sheet trigger on mobile */}
          <div className="lg:w-[280px] flex-shrink-0">
            <WorkTaskFilters
              tasks={enrichedTasks}
              onFilterChange={handleFilterChange}
              currentUserName="Current User"
              teamMembers={["E. Russ Aideyan", "Dr. Hall", "Lilian Ike", "Jonthan Guidry", "HR Director", "GRO Admin"]}
            />
          </div>

          {/* Task List Area */}
          <div className="flex-1 min-w-0">
            {/* Filtered result header */}
            <div className="flex items-center gap-2 mb-4">
              <LayoutList size={14} style={{ color: "#245C5A" }} />
              <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                Task List
              </span>
              <Badge variant="outline" className="text-[10px]">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {groupedTasks.length === 0 ? (
              <div className="rounded-lg border p-8 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <CheckCircle2 size={32} style={{ color: "#059669" }} className="mx-auto mb-3" />
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>All caught up!</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                  No tasks match the selected filters.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedTasks.map((group) => (
                  <div key={group.code}>
                    {/* Workflow Section Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <group.icon size={16} style={{ color: "#245C5A" }} />
                      <h2 className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>
                        {group.name}
                      </h2>
                      <Badge variant="outline" className="text-[10px]">{group.code}</Badge>
                      <span className="text-[11px] font-medium ml-1" style={{ color: "var(--topbar-subtitle)" }}>
                        ({group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""})
                      </span>
                    </div>

                    {/* Task Cards */}
                    <div className="space-y-3">
                      {group.tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isExpanded={expandedTask === task.id}
                          onToggleExpand={() => toggleExpand(task.id)}
                          onClaim={() => handleClaim(task.id)}
                          onComplete={() => openDialog("complete", task.id)}
                          onReassign={() => openDialog("reassign", task.id)}
                          onEscalate={() => openDialog("escalate", task.id)}
                          onComment={() => openDialog("comment", task.id)}
                          isClaiming={claimMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Dialogs ─── */}

        {/* Complete Dialog */}
        <Dialog open={dialogState.type === "complete"} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 size={18} style={{ color: "#059669" }} />
                Complete Task
              </DialogTitle>
              <DialogDescription>
                Mark this task as complete with evidence upload.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-[12px]">Evidence File</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="file"
                    className="text-[12px]"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                {file && (
                  <p className="text-[11px] mt-1" style={{ color: "#059669" }}>
                    <Upload size={10} className="inline mr-1" />
                    {file.name} selected
                  </p>
                )}
              </div>
              <div>
                <Label className="text-[12px]">Completion Notes</Label>
                <Textarea
                  className="mt-1.5 text-[12px] min-h-[80px]"
                  placeholder="Describe what was completed..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="text-[12px]">Cancel</Button>
              </DialogClose>
              <Button
                size="sm"
                className="text-[12px]"
                style={{ backgroundColor: "#059669" }}
                onClick={handleComplete}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                Mark Complete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reassign Dialog */}
        <Dialog open={dialogState.type === "reassign"} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog size={18} style={{ color: "#2563EB" }} />
                Reassign Task
              </DialogTitle>
              <DialogDescription>
                Transfer this task to another team member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-[12px]">New Assignee</Label>
                <Select value={reassignee} onValueChange={setReassignee}>
                  <SelectTrigger className="mt-1.5 text-[12px]">
                    <SelectValue placeholder="Select a team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="u1">E. Russ Aideyan</SelectItem>
                    <SelectItem value="u2">Dr. Hall</SelectItem>
                    <SelectItem value="u3">Lilian Ike</SelectItem>
                    <SelectItem value="u4">Jonthan Guidry</SelectItem>
                    <SelectItem value="u5">HR Director</SelectItem>
                    <SelectItem value="u6">GRO Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]">Reason for Reassignment</Label>
                <Textarea
                  className="mt-1.5 text-[12px] min-h-[80px]"
                  placeholder="Explain why this task is being reassigned..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="text-[12px]">Cancel</Button>
              </DialogClose>
              <Button
                size="sm"
                className="text-[12px]"
                style={{ backgroundColor: "#2563EB" }}
                onClick={handleReassign}
                disabled={!reassignee || reassignMutation.isPending}
              >
                {reassignMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <UserCog size={12} className="mr-1" />}
                Reassign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Escalate Dialog */}
        <Dialog open={dialogState.type === "escalate"} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertOctagon size={18} style={{ color: "#DC2626" }} />
                Escalate Task
              </DialogTitle>
              <DialogDescription>
                Escalate this task to a supervisor or manager.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-[12px]">Escalation Reason</Label>
                <Textarea
                  className="mt-1.5 text-[12px] min-h-[80px]"
                  placeholder="Describe why this task needs escalation..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="text-[12px]">Cancel</Button>
              </DialogClose>
              <Button
                size="sm"
                variant="destructive"
                className="text-[12px]"
                onClick={handleEscalate}
                disabled={!reason || escalateMutation.isPending}
              >
                {escalateMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <AlertOctagon size={12} className="mr-1" />}
                Escalate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comment Dialog */}
        <Dialog open={dialogState.type === "comment"} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare size={18} style={{ color: "#7C3AED" }} />
                Add Comment
              </DialogTitle>
              <DialogDescription>
                Leave a comment or note on this task.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-[12px]">Comment</Label>
                <Textarea
                  className="mt-1.5 text-[12px] min-h-[100px]"
                  placeholder="Enter your comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="text-[12px]">Cancel</Button>
              </DialogClose>
              <Button
                size="sm"
                className="text-[12px]"
                style={{ backgroundColor: "#7C3AED" }}
                onClick={handleComment}
                disabled={!comment || commentMutation.isPending}
              >
                {commentMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
                Post Comment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

/* ─── Task Card Sub-Component ───────────────────────────── */

interface TaskCardProps {
  task: EnrichedTask;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClaim: () => void;
  onComplete: () => void;
  onReassign: () => void;
  onEscalate: () => void;
  onComment: () => void;
  isClaiming: boolean;
}

function TaskCard({
  task,
  isExpanded,
  onToggleExpand,
  onClaim,
  onComplete,
  onReassign,
  onEscalate,
  onComment,
  isClaiming,
}: TaskCardProps) {
  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const sc = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
  const evidenceComplete = task.evidenceItems.filter((e) => e.status === "complete").length;
  const evidenceTotal = task.evidenceItems.length;
  const allEvidenceDone = evidenceComplete === evidenceTotal;

  return (
    <Card
      className="overflow-hidden transition-all"
      style={{
        borderColor: task.isOverdue ? "#fca5a5" : "var(--card-border)",
        backgroundColor: task.isOverdue ? "#FEF2F2" : "var(--card-bg)",
      }}
    >
      <CardContent className="p-4">
        {/* Top Row: Title + Badges */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {task.isOverdue && (
                <Badge
                  className="text-[9px] font-bold px-1.5 py-0.5"
                  style={{ backgroundColor: "#DC2626", color: "white" }}
                >
                  <AlertTriangle size={8} className="mr-0.5" />
                  OVERDUE
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[9px] font-medium px-1.5 py-0.5"
                style={{ borderColor: pc.border, color: pc.text, backgroundColor: pc.bg }}
              >
                {task.priority}
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] font-medium px-1.5 py-0.5"
                style={{ borderColor: sc.bg, color: sc.text, backgroundColor: sc.bg }}
              >
                {task.status}
              </Badge>
              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                {task.task_type}
              </Badge>
            </div>

            <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              {task.task_title}
            </h3>

            {/* Meta Row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                Due: {new Date(task.due_date).toLocaleDateString()}
              </span>
              <span>Assigned by: {task.assigned_to}</span>
              <span>Entity: {task.entity_type} ({task.entity_id})</span>
            </div>
          </div>

          {/* Expand Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="flex-shrink-0 h-7 w-7"
            onClick={onToggleExpand}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>

        {/* Evidence Summary Bar */}
        <div
          className="flex items-center gap-2 mt-3 px-2.5 py-1.5 rounded-md"
          style={{
            backgroundColor: allEvidenceDone ? "#ECFDF5" : "#f1f5f9",
            border: `1px solid ${allEvidenceDone ? "#86efac" : "#e2e8f0"}`,
          }}
        >
          {allEvidenceDone ? (
            <CheckCircle2 size={12} style={{ color: "#059669" }} />
          ) : (
            <Clock size={12} style={{ color: "#94a3b8" }} />
          )}
          <span className="text-[10px] font-medium" style={{ color: allEvidenceDone ? "#059669" : "#64748b" }}>
            Evidence: {evidenceComplete}/{evidenceTotal} complete
          </span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: allEvidenceDone ? "#86efac" : "#e2e8f0" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${evidenceTotal > 0 ? (evidenceComplete / evidenceTotal) * 100 : 0}%`,
                backgroundColor: allEvidenceDone ? "#059669" : "#D97706",
              }}
            />
          </div>
        </div>

        {/* Expanded Section: Evidence Checklist + Actions */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Evidence Checklist */}
            <div className="rounded-md border p-3" style={{ backgroundColor: "rgba(255,255,255,0.5)", borderColor: "var(--card-border)" }}>
              <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--topbar-title)" }}>
                <CheckSquare size={12} style={{ color: "#245C5A" }} />
                Evidence Gate Checklist
              </h4>
              <div className="space-y-1.5">
                {task.evidenceItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    {item.status === "complete" ? (
                      <CheckCircle2 size={12} style={{ color: "#059669" }} />
                    ) : (
                      <Square size={12} style={{ color: "#94a3b8" }} />
                    )}
                    <span
                      className="text-[11px]"
                      style={{
                        color: item.status === "complete" ? "#059669" : "var(--topbar-title)",
                        textDecoration: item.status === "complete" ? "line-through" : "none",
                      }}
                    >
                      {item.name}
                    </span>
                    {item.required && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0" style={{ borderColor: "#fca5a5", color: "#DC2626" }}>
                        REQ
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1 py-0 ml-auto"
                      style={{
                        borderColor: item.status === "complete" ? "#86efac" : "#fcd34d",
                        color: item.status === "complete" ? "#059669" : "#B45309",
                        backgroundColor: item.status === "complete" ? "#ECFDF5" : "#FFFBEB",
                      }}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
              {allEvidenceDone && (
                <div className="mt-2 text-[10px] font-semibold flex items-center gap-1" style={{ color: "#059669" }}>
                  <CheckCircle2 size={10} />
                  All evidence complete — ready for submission
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {task.status === "pending" && (
                <Button
                  size="sm"
                  className="text-[11px] h-8"
                  style={{ backgroundColor: "#245C5A" }}
                  onClick={onClaim}
                  disabled={isClaiming}
                >
                  {isClaiming ? <Loader2 size={10} className="animate-spin mr-1" /> : <UserCheck size={10} className="mr-1" />}
                  Claim
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-8"
                style={{ borderColor: "#059669", color: "#059669" }}
                onClick={onComplete}
              >
                <CheckCircle2 size={10} className="mr-1" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-8"
                style={{ borderColor: "#2563EB", color: "#2563EB" }}
                onClick={onReassign}
              >
                <UserCog size={10} className="mr-1" />
                Reassign
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-8"
                style={{ borderColor: "#DC2626", color: "#DC2626" }}
                onClick={onEscalate}
              >
                <AlertOctagon size={10} className="mr-1" />
                Escalate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-8"
                style={{ borderColor: "#7C3AED", color: "#7C3AED" }}
                onClick={onComment}
              >
                <MessageSquare size={10} className="mr-1" />
                Comment
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MyWorkTodayPage;
