import { useState } from "react";
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  Send,
  Eye,
  CheckSquare,
  MapPin,
  Camera,
  BookOpen,
  Heart,
  Monitor,
  Shield,
  FileCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X,
  Bell,
  GraduationCap,
  Search,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  completed: boolean;
  assignedDate: string;
  completedDate: string | null;
  assignedTo: string;
  overdue: boolean;
}

interface NewHire {
  id: string;
  name: string;
  position: string;
  startDate: string;
  progress: number;
  status: "on-track" | "at-risk" | "overdue";
  completedItems: number;
  totalItems: number;
  email: string;
  supervisor: string;
}

// ─── Demo Data ─────────────────────────────────────────────────
const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "CHK-001", title: "Facility Tour",
    description: "Guided tour of all campus buildings, units, common areas, and emergency exits.",
    icon: MapPin, iconColor: "#2563EB", iconBg: "#EFF6FF",
    completed: true, assignedDate: "2026-07-01", completedDate: "2026-07-01", assignedTo: "All", overdue: false,
  },
  {
    id: "CHK-002", title: "Badge Photo",
    description: "ID badge photo taken and badge printed. Activate access permissions.",
    icon: Camera, iconColor: "#7C3AED", iconBg: "#F3E8FF",
    completed: true, assignedDate: "2026-07-01", completedDate: "2026-07-01", assignedTo: "All", overdue: false,
  },
  {
    id: "CHK-003", title: "Handbook Review",
    description: "Read and acknowledge the Employee Handbook, Code of Conduct, and Ethics Policy.",
    icon: BookOpen, iconColor: "#0891B2", iconBg: "#CFFAFE",
    completed: true, assignedDate: "2026-07-01", completedDate: "2026-07-03", assignedTo: "All", overdue: false,
  },
  {
    id: "CHK-004", title: "Benefits Enrollment",
    description: "Complete health insurance, 401(k), and other benefits selections with HR.",
    icon: Heart, iconColor: "#DC2626", iconBg: "#FEF2F2",
    completed: true, assignedDate: "2026-07-01", completedDate: "2026-07-05", assignedTo: "All", overdue: false,
  },
  {
    id: "CHK-005", title: "IT Setup",
    description: "Laptop provisioned, accounts created, AMOS-OPS access granted, email configured.",
    icon: Monitor, iconColor: "#EA580C", iconBg: "#FFF7ED",
    completed: false, assignedDate: "2026-07-01", completedDate: null, assignedTo: "Michael Foster", overdue: true,
  },
  {
    id: "CHK-006", title: "Safety Training",
    description: "Complete CPR/First Aid certification, CPI training, and emergency response drills.",
    icon: Shield, iconColor: "#D97706", iconBg: "#FFFBEB",
    completed: false, assignedDate: "2026-07-02", completedDate: null, assignedTo: "Demo Clinical Lead", overdue: false,
  },
  {
    id: "CHK-007", title: "Policy Acknowledgments",
    description: "Electronically sign all required policy acknowledgments: HIPAA, Confidentiality, Safety.",
    icon: FileCheck, iconColor: "#059669", iconBg: "#ECFDF5",
    completed: false, assignedDate: "2026-07-03", completedDate: null, assignedTo: "All", overdue: false,
  },
  {
    id: "CHK-008", title: "Supervisor Meeting",
    description: "One-on-one meeting with direct supervisor to discuss role expectations and goals.",
    icon: UserCheck, iconColor: "#245C5A", iconBg: "#F0FDFA",
    completed: false, assignedDate: "2026-07-07", completedDate: null, assignedTo: "All", overdue: false,
  },
];

const DEMO_NEW_HIRES: NewHire[] = [
  {
    id: "NH-001", name: "Synthetic-Person-037 Watson", position: "Residential Counselor",
    startDate: "2026-07-01", progress: 75, status: "on-track",
    completedItems: 6, totalItems: 8, email: "e.watson@example.invalid", supervisor: "James Rodriguez",
  },
  {
    id: "NH-002", name: "Synthetic-Person-019 Lee", position: "Case Manager",
    startDate: "2026-07-01", progress: 62, status: "on-track",
    completedItems: 5, totalItems: 8, email: "j.lee@example.invalid", supervisor: "Dr. Synthetic Youth 035",
  },
  {
    id: "NH-003", name: "Taylor Brooks", position: "Mental Health Technician",
    startDate: "2026-07-08", progress: 25, status: "at-risk",
    completedItems: 2, totalItems: 8, email: "t.brooks@example.invalid", supervisor: "Demo Clinical Lead",
  },
  {
    id: "NH-004", name: "Alex Rivera", position: "Therapist",
    startDate: "2026-07-08", progress: 12, status: "at-risk",
    completedItems: 1, totalItems: 8, email: "a.rivera@example.invalid", supervisor: "Dr. Synthetic Youth 035",
  },
];

// ─── Status Config ─────────────────────────────────────────────
const HIRE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  "on-track": { label: "On Track", color: "#059669", bg: "#ECFDF5" },
  "at-risk": { label: "At Risk", color: "#D97706", bg: "#FFFBEB" },
  overdue: { label: "Overdue", color: "#DC2626", bg: "#FEF2F2" },
};

// ─── Main Component ────────────────────────────────────────────
export default function UniversalOrientationPage() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST_ITEMS);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showChecklistFor, setShowChecklistFor] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // KPIs
  const enrolled = DEMO_NEW_HIRES.length;
  const completed = 18;
  const overdue = checklist.filter((c) => c.overdue && !c.completed).length;
  const avgCompletionDays = 14;

  // Overall progress
  const totalItems = checklist.length;
  const completedItems = checklist.filter((c) => c.completed).length;
  const overallProgress = Math.round((completedItems / totalItems) * 100);

  const toggleItemComplete = (id: string) => {
    setChecklist(checklist.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          completed: !c.completed,
          completedDate: !c.completed ? "2026-07-08" : null,
        };
      }
      return c;
    }));
  };

  const sendReminder = (itemId: string) => {
    setReminderSent(itemId);
    setTimeout(() => setReminderSent(null), 2000);
  };

  const filteredHires = DEMO_NEW_HIRES.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.supervisor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <GraduationCap size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Universal Orientation Track</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Standardized onboarding checklist and progress tracking for all new hires
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Enrolled", value: enrolled, color: "#245C5A", bg: "#F0FDFA", icon: Users },
          { label: "Completed", value: completed, color: "#059669", bg: "#ECFDF5", icon: CheckCircle },
          { label: "Overdue", value: overdue, color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
          { label: "Avg Completion", value: `${avgCompletionDays} days`, color: "#D97706", bg: "#FFFBEB", icon: Clock },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                  <Icon size={16} style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Overall Progress Summary */}
      <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: "#245C5A" }} />
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Overall Orientation Progress</h3>
          </div>
          <span className="text-[12px] font-bold" style={{ color: "#245C5A" }}>{overallProgress}%</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${overallProgress}%`, backgroundColor: overallProgress >= 75 ? "#059669" : overallProgress >= 50 ? "#245C5A" : "#D97706" }}
          />
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: "var(--topbar-subtitle)" }}>
          {completedItems} of {totalItems} checklist items completed across all active new hires
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── ORIENTATION CHECKLIST ──────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <CheckSquare size={16} style={{ color: "#245C5A" }} />
              Orientation Checklist
            </h3>
            <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
              {completedItems}/{totalItems} done
            </span>
          </div>

          <div className="space-y-2">
            {checklist.map((item) => {
              const isExpanded = expandedItem === item.id;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border overflow-hidden transition-all"
                  style={{
                    borderColor: item.overdue && !item.completed ? "#FCA5A5" : "var(--card-border)",
                    backgroundColor: item.overdue && !item.completed ? "#FEF2F2" : "var(--card-bg)",
                  }}
                >
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleItemComplete(item.id); }}
                      className="flex-shrink-0 cursor-pointer"
                    >
                      {item.completed ? (
                        <CheckCircle size={20} style={{ color: "#059669" }} />
                      ) : (
                        <Circle size={20} style={{ color: item.overdue ? "#DC2626" : "#D1D5DB" }} />
                      )}
                    </button>
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.iconBg }}>
                      <Icon size={14} style={{ color: item.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-[12px] font-semibold ${item.completed ? "line-through" : ""}`} style={{ color: item.completed ? "var(--topbar-subtitle)" : "var(--topbar-title)" }}>
                          {item.title}
                        </p>
                        {item.overdue && !item.completed && (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                            <AlertTriangle size={8} /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] line-clamp-1" style={{ color: "var(--topbar-subtitle)" }}>{item.description}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
                  </button>

                  {isExpanded && (
                    <div className="border-t px-3 pb-3" style={{ borderColor: "var(--card-border)" }}>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="p-2 rounded" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                          <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Assigned</p>
                          <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{item.assignedDate}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                          <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Completed</p>
                          <p className="text-[11px] font-medium" style={{ color: item.completedDate ? "#059669" : "#6B7280" }}>
                            {item.completedDate ?? "Pending"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {!item.completed && (
                          <button
                            onClick={() => toggleItemComplete(item.id)}
                            className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg font-medium text-white cursor-pointer transition-all hover:opacity-90"
                            style={{ backgroundColor: "#245C5A" }}
                          >
                            <CheckCircle size={10} /> Mark Complete
                          </button>
                        )}
                        {!item.completed && (
                          <button
                            onClick={() => sendReminder(item.id)}
                            className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg font-medium cursor-pointer border"
                            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
                          >
                            {reminderSent === item.id ? (
                              <>
                                <CheckCircle size={10} style={{ color: "#059669" }} />
                                <span style={{ color: "#059669" }}>Sent!</span>
                              </>
                            ) : (
                              <>
                                <Send size={10} /> Send Reminder
                              </>
                            )}
                          </button>
                        )}
                        {item.completed && (
                          <button
                            onClick={() => toggleItemComplete(item.id)}
                            className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg font-medium cursor-pointer border"
                            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
                          >
                            <Circle size={10} /> Mark Incomplete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── NEW HIRES TABLE ────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={16} style={{ color: "#245C5A" }} />
              New Hires
            </h3>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-[11px] rounded-md border bg-transparent"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Name</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Position</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Start Date</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Progress</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHires.map((hire) => {
                    const stCfg = HIRE_STATUS[hire.status];
                    return (
                      <tr key={hire.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: "var(--card-border)" }}>
                        <td className="py-2.5 px-3">
                          <p className="font-medium" style={{ color: "var(--topbar-title)" }}>{hire.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{hire.email}</p>
                        </td>
                        <td className="py-2.5 px-3" style={{ color: "var(--topbar-subtitle)" }}>{hire.position}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }}>{hire.startDate}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                              <div className="h-full rounded-full" style={{ width: `${hire.progress}%`, backgroundColor: hire.progress >= 75 ? "#059669" : hire.progress >= 40 ? "#D97706" : "#DC2626" }} />
                            </div>
                            <span className="text-[10px] font-medium">{hire.progress}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                            {stCfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setShowChecklistFor(hire.id)}
                              className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                              style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}
                            >
                              <Eye size={10} className="inline mr-0.5" /> View
                            </button>
                            <button
                              onClick={() => sendReminder(hire.id)}
                              className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                              style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}
                            >
                              <Bell size={10} className="inline mr-0.5" /> Remind
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="rounded-lg border p-4 mt-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h4 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Orientation Summary</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Avg Items per Hire</p>
                <p className="text-[16px] font-bold" style={{ color: "#245C5A" }}>
                  {(DEMO_NEW_HIRES.reduce((acc, h) => acc + h.completedItems, 0) / DEMO_NEW_HIRES.length).toFixed(1)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>On Track</p>
                <p className="text-[16px] font-bold" style={{ color: "#059669" }}>
                  {DEMO_NEW_HIRES.filter((h) => h.status === "on-track").length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── View Checklist Modal ─────────────────────────────── */}
      {showChecklistFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>
                    Individual Checklist
                  </h3>
                  <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {DEMO_NEW_HIRES.find((h) => h.id === showChecklistFor)?.name} — {DEMO_NEW_HIRES.find((h) => h.id === showChecklistFor)?.position}
                  </p>
                </div>
                <button onClick={() => setShowChecklistFor(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>

              {/* Individual progress */}
              {(() => {
                const hire = DEMO_NEW_HIRES.find((h) => h.id === showChecklistFor);
                if (!hire) return null;
                return (
                  <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Progress</span>
                      <span className="text-[12px] font-bold" style={{ color: "#245C5A" }}>{hire.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                      <div className="h-full rounded-full" style={{ width: `${hire.progress}%`, backgroundColor: "#245C5A" }} />
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                {checklist.map((item) => {
                  const Icon = item.icon;
                  // Simulate per-hire completion with deterministic pseudo-randomness
                  const hireIndex = DEMO_NEW_HIRES.findIndex((h) => h.id === showChecklistFor);
                  const itemIndex = parseInt(item.id.split("-")[1]) - 1;
                  const isComplete = hireIndex !== -1 && itemIndex < DEMO_NEW_HIRES[hireIndex].completedItems;

                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                      {isComplete ? (
                        <CheckCircle size={16} style={{ color: "#059669" }} />
                      ) : (
                        <Circle size={16} style={{ color: "#D1D5DB" }} />
                      )}
                      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.iconBg }}>
                        <Icon size={12} style={{ color: item.iconColor }} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-[12px] font-medium ${isComplete ? "line-through" : ""}`} style={{ color: isComplete ? "var(--topbar-subtitle)" : "var(--topbar-title)" }}>
                          {item.title}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{item.description}</p>
                      </div>
                      {isComplete && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>Done</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
