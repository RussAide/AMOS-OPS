import { useState } from "react";
import {
  GraduationCap,
  Users,
  CheckCircle,
  TrendingUp,
  BookOpen,
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  Award,
  UserPlus,
  Shield,
  Monitor,
  Stethoscope,
  FileText,
  Heart,
  X,
  Save,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface Cohort {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  members: CohortMember[];
  status: "active" | "completed";
}

interface CohortMember {
  name: string;
  position: string;
  progress: number;
  modulesCompleted: number;
  totalModules: number;
}

interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  status: "completed" | "in-progress" | "not-started";
  progress: number;
  totalLessons: number;
  completedLessons: number;
}

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_COHORTS: Cohort[] = [
  {
    id: "CH-26-07",
    name: "Cohort 26-07",
    startDate: "2026-07-01",
    endDate: "2026-07-15",
    status: "active",
    members: [
      { name: "Synthetic-Person-037 Watson", position: "Residential Counselor", progress: 75, modulesCompleted: 5, totalModules: 7 },
      { name: "Synthetic-Person-019 Lee", position: "Case Manager", progress: 60, modulesCompleted: 4, totalModules: 7 },
    ],
  },
  {
    id: "CH-26-08",
    name: "Cohort 26-08",
    startDate: "2026-07-15",
    endDate: "2026-07-29",
    status: "active",
    members: [
      { name: "Taylor Brooks", position: "Mental Health Technician", progress: 25, modulesCompleted: 1, totalModules: 7 },
      { name: "Alex Rivera", position: "Therapist", progress: 15, modulesCompleted: 1, totalModules: 7 },
    ],
  },
];

const CURRICULUM_MODULES: CurriculumModule[] = [
  {
    id: "MOD-001", title: "Welcome & Culture",
    description: "Introduction to AMOS mission, values, organizational culture, and team structure.",
    duration: "2 hours", icon: Heart, iconColor: "#DC2626", iconBg: "#FEF2F2",
    status: "completed", progress: 100, totalLessons: 6, completedLessons: 6,
  },
  {
    id: "MOD-002", title: "Policies & Procedures",
    description: "Comprehensive review of organizational policies, SOPs, and operational guidelines.",
    duration: "3 hours", icon: FileText, iconColor: "#2563EB", iconBg: "#EFF6FF",
    status: "completed", progress: 100, totalLessons: 10, completedLessons: 10,
  },
  {
    id: "MOD-003", title: "Safety & Emergency",
    description: "Safety protocols, emergency procedures, crisis intervention, and de-escalation techniques.",
    duration: "4 hours", icon: Shield, iconColor: "#D97706", iconBg: "#FFFBEB",
    status: "completed", progress: 100, totalLessons: 8, completedLessons: 8,
  },
  {
    id: "MOD-004", title: "Technology & Systems",
    description: "AMOS-OPS platform navigation, EHR basics, and digital documentation workflows.",
    duration: "3 hours", icon: Monitor, iconColor: "#7C3AED", iconBg: "#F3E8FF",
    status: "in-progress", progress: 65, totalLessons: 12, completedLessons: 8,
  },
  {
    id: "MOD-005", title: "Clinical Orientation",
    description: "CANS assessment, treatment planning, clinical documentation, and therapeutic modalities.",
    duration: "5 hours", icon: Stethoscope, iconColor: "#0891B2", iconBg: "#CFFAFE",
    status: "in-progress", progress: 40, totalLessons: 15, completedLessons: 6,
  },
  {
    id: "MOD-006", title: "Documentation Training",
    description: "Charting standards, progress notes, incident reports, and audit readiness.",
    duration: "3 hours", icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    status: "not-started", progress: 0, totalLessons: 9, completedLessons: 0,
  },
  {
    id: "MOD-007", title: "Compliance Essentials",
    description: "HIPAA, state regulations, incident reporting, credentialing, and audit compliance.",
    duration: "2 hours", icon: Shield, iconColor: "#EA580C", iconBg: "#FFF7ED",
    status: "not-started", progress: 0, totalLessons: 7, completedLessons: 0,
  },
];

// ─── Status Config ─────────────────────────────────────────────
const MODULE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "#059669", bg: "#ECFDF5" },
  "in-progress": { label: "In Progress", color: "#D97706", bg: "#FFFBEB" },
  "not-started": { label: "Not Started", color: "#6B7280", bg: "#F3F4F6" },
};

// ─── Main Component ────────────────────────────────────────────
export default function OnboardingAcademyPage() {
  const [expandedCohort, setExpandedCohort] = useState<string | null>("CH-26-07");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cohorts" | "curriculum">("cohorts");
  const [showAssignModal, setShowAssignModal] = useState(false);

  // KPIs
  const activeCohorts = DEMO_COHORTS.filter((c) => c.status === "active").length;
  const totalGraduated = 24;
  const inProgress = DEMO_COHORTS.reduce((acc, c) => acc + c.members.length, 0);
  const completionRate = 92;

  const toggleCohort = (id: string) => setExpandedCohort(expandedCohort === id ? null : id);
  const toggleModule = (id: string) => setExpandedModule(expandedModule === id ? null : id);

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <GraduationCap size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Onboarding Academy</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Structured training programs and curriculum for new hires
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Cohorts", value: activeCohorts, color: "#245C5A", bg: "#F0FDFA", icon: Users },
          { label: "Total Graduated", value: totalGraduated, color: "#059669", bg: "#ECFDF5", icon: Award },
          { label: "In Progress", value: inProgress, color: "#2563EB", bg: "#EFF6FF", icon: Clock },
          { label: "Completion Rate", value: `${completionRate}%`, color: "#D97706", bg: "#FFFBEB", icon: TrendingUp },
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        {([
          { key: "cohorts" as const, label: "Active Cohorts", icon: Users },
          { key: "curriculum" as const, label: "Curriculum", icon: BookOpen },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg flex items-center gap-2"
              style={{
                color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
                borderBottom: activeTab === tab.key ? "2px solid #245C5A" : "2px solid transparent",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── COHORTS TAB ──────────────────────────────────────── */}
      {activeTab === "cohorts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Active Cohorts</h3>
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90"
              style={{ backgroundColor: "#245C5A" }}
            >
              <UserPlus size={14} /> Assign to Cohort
            </button>
          </div>

          {DEMO_COHORTS.map((cohort) => {
            const isExpanded = expandedCohort === cohort.id;
            return (
              <div key={cohort.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                {/* Cohort Header */}
                <button
                  onClick={() => toggleCohort(cohort.id)}
                  className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-black/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
                      <Users size={16} style={{ color: "#245C5A" }} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{cohort.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {cohort.members.length} new hires · {cohort.startDate} to {cohort.endDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium capitalize" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                      {cohort.status}
                    </span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: "#6B7280" }} /> : <ChevronDown size={16} style={{ color: "#6B7280" }} />}
                  </div>
                </button>

                {/* Cohort Members */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4" style={{ borderColor: "var(--card-border)" }}>
                    <table className="w-full text-[12px] mt-3">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                          <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Name</th>
                          <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Position</th>
                          <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Progress</th>
                          <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Modules</th>
                          <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohort.members.map((member, i) => (
                          <tr key={i} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                            <td className="py-2.5 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{member.name}</td>
                            <td className="py-2.5 px-2" style={{ color: "var(--topbar-subtitle)" }}>{member.position}</td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                                  <div className="h-full rounded-full transition-all" style={{ width: `${member.progress}%`, backgroundColor: member.progress >= 80 ? "#059669" : member.progress >= 40 ? "#D97706" : "#DC2626" }} />
                                </div>
                                <span className="text-[10px] font-medium">{member.progress}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                              {member.modulesCompleted}/{member.totalModules}
                            </td>
                            <td className="py-2.5 px-2">
                              <button className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                                View Progress
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CURRICULUM TAB ───────────────────────────────────── */}
      {activeTab === "curriculum" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Curriculum Modules</h3>
            <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>{CURRICULUM_MODULES.length} modules</span>
          </div>

          {CURRICULUM_MODULES.map((module) => {
            const isExpanded = expandedModule === module.id;
            const statusCfg = MODULE_STATUS[module.status];
            const Icon = module.icon;
            return (
              <div key={module.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-black/[0.02]"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: module.iconBg }}>
                    <Icon size={18} style={{ color: module.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{module.title}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] line-clamp-1" style={{ color: "var(--topbar-subtitle)" }}>{module.description}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} style={{ color: "var(--topbar-subtitle)" }} />
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{module.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                        <div className="h-full rounded-full" style={{ width: `${module.progress}%`, backgroundColor: module.progress === 100 ? "#059669" : module.progress > 0 ? "#D97706" : "#E5E7EB" }} />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: module.progress === 100 ? "#059669" : "var(--topbar-subtitle)" }}>
                        {module.progress}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} style={{ color: "#6B7280" }} /> : <ChevronDown size={16} style={{ color: "#6B7280" }} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                        Lessons: {module.completedLessons}/{module.totalLessons} completed
                      </p>
                      <div className="flex gap-2">
                        {module.status !== "completed" && (
                          <button className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg font-medium text-white cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
                            <Play size={10} /> Start Module
                          </button>
                        )}
                        {module.status === "completed" && (
                          <span className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                            <CheckCircle size={10} /> Completed
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Lesson progress bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(module.completedLessons / module.totalLessons) * 100}%`,
                          backgroundColor: module.progress === 100 ? "#059669" : "#245C5A",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Assign to Cohort Modal ───────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                  <UserPlus size={16} style={{ color: "#245C5A" }} /> Assign to Cohort
                </h3>
                <button onClick={() => setShowAssignModal(false)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Select Cohort</label>
                  <select className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
                    <option value="">Choose a cohort...</option>
                    {DEMO_COHORTS.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.startDate} - {c.endDate})</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Employee Name</label>
                  <input placeholder="Search employee..." className="w-full text-[12px] rounded-md border px-3 py-2" style={{ borderColor: "var(--card-border)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Position</label>
                  <select className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
                    <option value="">Select position...</option>
                    <option value="rc">Residential Counselor</option>
                    <option value="cm">Case Manager</option>
                    <option value="mht">Mental Health Technician</option>
                    <option value="therapist">Therapist</option>
                    <option value="nurse">Licensed Vocational Nurse</option>
                  </select>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 flex items-center justify-center gap-1 text-[12px] font-medium py-2.5 rounded-lg text-white cursor-pointer transition-all hover:opacity-90"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    <Save size={13} /> Assign
                  </button>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2.5 rounded-lg text-[12px] font-medium border cursor-pointer"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
