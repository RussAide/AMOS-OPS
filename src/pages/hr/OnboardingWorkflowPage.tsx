import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  GraduationCap, ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  Users, ChevronRight, ArrowRight, Search, FileCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useHR } from "@/context/HRContext";
import { getHRModule } from "@/data/hrLifecycleData";

const ACTIVATION_MODULES = [
  { id: "recruitment", label: "Recruitment", icon: Users, color: "#245C5A" },
  { id: "screening", label: "Screening", icon: FileCheck, color: "#2563EB" },
  { id: "offers", label: "Offers", icon: FileCheck, color: "#7C3AED" },
  { id: "orientation", label: "Orientation", icon: GraduationCap, color: "#059669" },
  { id: "onboarding", label: "Onboarding", icon: GraduationCap, color: "#D97706" },
  { id: "clearance", label: "Clearance", icon: CheckCircle2, color: "#059669" },
];

export function OnboardingWorkflowPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: people = [] } = trpc.hr.listPeople.useQuery();
  const { data: moduleStatuses = [] } = trpc.hr.getModuleStatuses.useQuery(undefined);

  // Build person onboarding status
  const personRows = people
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
    })
    .map((p) => {
      const statuses = moduleStatuses.filter((s) => s.personId === p.id);
      const statusMap: Record<string, string> = {};
      for (const s of statuses) statusMap[s.moduleId] = s.statusId;

      // Compute activation progress
      const modStatuses = ACTIVATION_MODULES.map((m) => {
        const sid = statusMap[m.id] || "";
        const mod = getHRModule(m.id);
        const statusDef = mod?.statusModel.find((s) => s.id === sid);
        const isComplete = statusDef?.category === "complete" || sid.includes("closed") || sid.includes("done") || sid.includes("signed") || sid === "c-cleared";
        const isTerminal = statusDef?.category === "terminal";
        return { moduleId: m.id, statusId: sid, isComplete, isTerminal, label: statusDef?.label || "Not Started" };
      });

      const completedCount = modStatuses.filter((m) => m.isComplete).length;
      const progress = Math.round((completedCount / ACTIVATION_MODULES.length) * 100);
      const isCleared = statusMap["clearance"] === "c-cleared";
      const currentStep = modStatuses.find((m) => !m.isComplete && !m.isTerminal);

      return {
        person: p,
        modStatuses,
        progress,
        isCleared,
        completedCount,
        currentStep: currentStep ? ACTIVATION_MODULES.find((a) => a.id === currentStep.moduleId)?.label || currentStep.moduleId : "Complete",
      };
    })
    .sort((a, b) => b.progress - a.progress);

  const inProgress = personRows.filter((r) => r.progress > 0 && r.progress < 100);
  const completed = personRows.filter((r) => r.progress === 100 || r.isCleared);
  const notStarted = personRows.filter((r) => r.progress === 0);

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Onboarding Workflow</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <GraduationCap size={22} style={{ color: "#245C5A" }} />
          Onboarding Workflow
        </h1>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Track workforce activation pipeline from recruitment through clearance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "In Progress", value: inProgress.length, color: "#D97706", bg: "#FFFBEB", icon: Clock },
          { label: "Cleared", value: completed.length, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
          { label: "Not Started", value: notStarted.length, color: "#6B7280", bg: "#F3F4F6", icon: AlertTriangle },
          { label: "Total People", value: personRows.length, color: "#245C5A", bg: "#F0FDFA", icon: Users },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} style={{ color: c.color }} />
              <span className="text-[10px] font-medium" style={{ color: c.color }}>{c.label}</span>
            </div>
            <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {ACTIVATION_MODULES.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.color + "15" }}>
              <m.icon size={10} style={{ color: m.color }} />
            </div>
            <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{m.label}</span>
            {i < ACTIVATION_MODULES.length - 1 && <ChevronRight size={10} style={{ color: "#CBD5E1" }} />}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
        <Input placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
      </div>

      {/* Pipeline Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th className="text-left px-4 py-3 font-semibold">Person</th>
              {ACTIVATION_MODULES.map((m) => (
                <th key={m.id} className="text-center px-2 py-3 font-semibold">
                  <m.icon size={12} style={{ color: m.color }} className="mx-auto" />
                </th>
              ))}
              <th className="text-right px-4 py-3 font-semibold">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {personRows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12">
                <Users size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p style={{ color: "var(--topbar-subtitle)" }}>No people found</p>
              </td></tr>
            ) : (
              personRows.map((row) => (
                <tr key={row.person.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/hr/person/${row.person.id}`)} className="text-left">
                      <div className="font-medium text-[12px] hover:underline" style={{ color: "#245C5A" }}>
                        {row.person.firstName} {row.person.lastName}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{row.person.role}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: row.isCleared ? "#059669" : "#D97706" }}>
                        {row.isCleared ? "Cleared for Duty" : `At: ${row.currentStep}`}
                      </div>
                    </button>
                  </td>
                  {row.modStatuses.map((ms) => (
                    <td key={ms.moduleId} className="px-2 py-3 text-center">
                      {ms.isComplete ? (
                        <CheckCircle2 size={14} style={{ color: "#059669" }} className="mx-auto" />
                      ) : ms.isTerminal ? (
                        <AlertTriangle size={14} style={{ color: "#DC2626" }} className="mx-auto" />
                      ) : ms.statusId ? (
                        <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: "#D97706" }} />
                      ) : (
                        <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: "#E5E7EB" }} />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${row.progress}%`, backgroundColor: row.isCleared ? "#059669" : row.progress > 0 ? "#D97706" : "#9CA3AF" }} />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: row.isCleared ? "#059669" : "var(--topbar-title)" }}>
                        {row.progress}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OnboardingWorkflowPage;
