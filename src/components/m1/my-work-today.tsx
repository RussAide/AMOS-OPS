import { ClipboardList, AlertTriangle, CheckCircle, ShieldCheck } from "lucide-react";
import { readNullableString, readString, toRecords } from "@/components/data/record-utils";
import { trpc } from "@/providers/trpc";

interface WorkTask {
  id: string;
  priority: string;
  task_title: string;
  task_type: string;
  entity_type: string | null;
  status: string;
}

function normalizeWorkTask(value: Record<string, unknown>): WorkTask | null {
  const id = readString(value, "id");
  if (!id) return null;
  return {
    id,
    priority: readString(value, "priority", "medium"),
    task_title: readString(value, "task_title", "Untitled task"),
    task_type: readString(value, "task_type", "Task"),
    entity_type: readNullableString(value, "entity_type"),
    status: readString(value, "status", "pending"),
  };
}

export function MyWorkToday() {
  const { data: kpis } = trpc.m1.dashboardKPIs.useQuery();
  const { data: rawTasks } = trpc.m1.getWorkQueue.useQuery({});
  const tasks = toRecords(rawTasks).flatMap((task) => {
    const normalized = normalizeWorkTask(task);
    return normalized ? [normalized] : [];
  });

  const stats = [
    { label: "Pending Tasks", value: kpis?.pendingTasks ?? 0, icon: ClipboardList, color: "#D97706" },
    { label: "Modules Done", value: `${kpis?.completionRate ?? 0}%`, icon: CheckCircle, color: "#059669" },
    { label: "Cred Alerts", value: kpis?.credentialAlerts ?? 0, icon: AlertTriangle, color: "#DC2626" },
    { label: "RTD Ready", value: kpis?.rtdReady ?? 0, icon: ShieldCheck, color: "#245C5A" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} style={{ color: s.color }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</span>
              </div>
              <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Task List */}
      <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>My Work Today</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#245C5A15", color: "#245C5A" }}>
            {tasks?.length ?? 0} active
          </span>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {(!tasks || tasks.length === 0) ? (
            <div className="p-6 text-center">
              <ClipboardList size={24} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-2" />
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>No pending tasks</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 border-b last:border-b-0" style={{ borderColor: "var(--card-border)" }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                  backgroundColor: task.priority === "urgent" ? "#DC2626" : task.priority === "high" ? "#D97706" : "#059669"
                }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{task.task_title}</p>
                  <p className="text-[10px] truncate" style={{ color: "var(--topbar-subtitle)" }}>{task.task_type} {task.entity_type ? `| ${task.entity_type}` : ""}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{
                  backgroundColor: task.status === "completed" ? "#05966915" : task.status === "in-progress" ? "#2563EB15" : "#D9770615",
                  color: task.status === "completed" ? "#059669" : task.status === "in-progress" ? "#2563EB" : "#D97706",
                }}>
                  {task.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
