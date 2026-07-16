import { useState } from "react";
import { ListTodo, Clock, CheckCircle2, Pill, ClipboardList, MessageSquare, Calendar, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/shell/page-layout";

const CATEGORY_CONFIG: Record<string, { icon: typeof ListTodo; color: string; label: string }> = {
  medication: { icon: Pill, color: "#2563EB", label: "Medications" },
  meeting: { icon: MessageSquare, color: "#059669", label: "Meetings" },
  documentation: { icon: ClipboardList, color: "#7C3AED", label: "Documentation" },
  shift: { icon: Calendar, color: "#D97706", label: "Shift" },
  family_contact: { icon: MessageSquare, color: "#0891B2", label: "Family Contact" },
  intake: { icon: ListTodo, color: "#DC2626", label: "Intake" },
  general: { icon: ListTodo, color: "#64748b", label: "General" },
};

interface WorkQueueTask {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueTime?: string;
  assignee?: string;
  notes?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function normalizeTask(value: unknown): WorkQueueTask | null {
  if (!isRecord(value)) return null;
  const id = readText(value, "id");
  if (!id) return null;
  return {
    id,
    title: readText(value, "title", "task_title"),
    category: readText(value, "category", "type", "task_type") || "general",
    priority: readText(value, "priority") || "medium",
    status: readText(value, "status") || "pending",
    dueTime: readText(value, "dueTime", "dueDate", "due_date") || undefined,
    assignee: readText(value, "assignee", "assignedTo", "assigned_to") || undefined,
    notes: readText(value, "notes", "description") || undefined,
  };
}

export function MyWorkTodayPage() {
  const utils = trpc.useUtils();
  const { data: rawQueue = [] } = trpc.m1.getWorkQueue.useQuery();
  const updateTask = trpc.m1.transitionTaskStatus.useMutation({ onSuccess: () => utils.m1.getWorkQueue.invalidate() });
  const createTaskMut = trpc.m1.createWorkTask.useMutation({ onSuccess: () => { utils.m1.getWorkQueue.invalidate(); setNewTask(""); } });
  const [filter, setFilter] = useState("all");
  const [newTask, setNewTask] = useState("");

  const queueValue: unknown = rawQueue;
  const rawTasks = Array.isArray(queueValue)
    ? queueValue
    : isRecord(queueValue) && Array.isArray(queueValue.items)
      ? queueValue.items
      : [];
  const tasks = rawTasks.map(normalizeTask).filter((task): task is WorkQueueTask => task !== null);

  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");
  const urgent = pending.filter((t) => t.priority === "urgent" || t.priority === "high");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.category === filter);

  const toggleComplete = (task: WorkQueueTask) => {
    updateTask.mutate({ taskId: task.id, fromStatus: task.status, toStatus: task.status === "completed" ? "pending" : "completed", evidenceProvided: true });
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    createTaskMut.mutate({ taskTitle: newTask, taskType: "general", priority: "medium", assignedTo: "Current User", description: "" });
  };

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[20px] font-bold" style={{ color: "#245C5A" }}>{pending.length}</div>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Pending</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[20px] font-bold" style={{ color: "#059669" }}>{completed.length}</div>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Completed</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[20px] font-bold" style={{ color: "#DC2626" }}>{urgent.length}</div>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Urgent</div>
        </div>
        <div className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="text-[20px] font-bold" style={{ color: "#D97706" }}>{tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0}%</div>
          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Done</div>
        </div>
      </div>

      {/* Add Task */}
      <div className="flex gap-2 mb-4">
        <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Add a new task..." className="text-xs" onKeyDown={e => e.key === "Enter" && addTask()} />
        <Button size="sm" onClick={addTask} className="bg-[#245C5A] hover:bg-[#1a3a38] text-white"><Plus size={14} /></Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "medication", "documentation", "meeting", "shift", "family_contact", "intake"].map(f => {
          const count = f === "all" ? tasks.length : tasks.filter((t) => t.category === f).length;
          if (count === 0 && f !== "all") return null;
          return (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors" style={{ backgroundColor: filter === f ? "#245C5A" : "var(--card-bg)", borderColor: filter === f ? "#245C5A" : "var(--card-border)", color: filter === f ? "#fff" : "var(--topbar-subtitle)" }}>
              {f === "all" ? "All Tasks" : (CATEGORY_CONFIG[f]?.label || f)} ({count})
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((t) => {
          const isDone = t.status === "completed";
          const cat = CATEGORY_CONFIG[t.category] || { icon: ListTodo, color: "#64748b", label: "General" };
          const Icon = cat.icon;
          return (
            <div key={t.id} className="rounded-lg border p-3 flex items-start gap-3 transition-opacity" style={{ backgroundColor: isDone ? "#f8fafc" : "var(--card-bg)", borderColor: "var(--card-border)", opacity: isDone ? 0.6 : 1 }}>
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer" style={{ borderColor: isDone ? "#059669" : "var(--card-border)", backgroundColor: isDone ? "#059669" : "transparent" }} onClick={() => toggleComplete(t)}>
                {isDone && <CheckCircle2 size={12} style={{ color: "#fff" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium" style={{ color: isDone ? "var(--topbar-subtitle)" : "var(--topbar-title)", textDecoration: isDone ? "line-through" : "none" }}>{t.title}</span>
                  {t.priority === "urgent" && !isDone && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Urgent</span>}
                  {t.priority === "high" && !isDone && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FFF7ED", color: "#D97706" }}>High</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span className="flex items-center gap-1"><Icon size={10} style={{ color: cat.color }} /> {cat.label}</span>
                  {t.dueTime && <span className="flex items-center gap-1"><Clock size={10} /> Due: {t.dueTime}</span>}
                  {t.assignee && <span>Assignee: {t.assignee}</span>}
                  {t.notes && <span className="italic">{t.notes}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>No tasks in this category</p>}
      </div>
    </PageLayout>
  );
}

export default MyWorkTodayPage;
