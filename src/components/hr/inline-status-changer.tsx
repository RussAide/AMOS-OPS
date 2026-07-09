import { useState } from "react";
import { useHR } from "@/context/hr-context";
import { getHRModule, getModuleStatusOptions } from "@/data/hrLifecycleData";
import { CheckCircle, XCircle, ChevronDown } from "lucide-react";

interface Props {
  personId: string;
  personName: string;
  moduleId: string;
  currentStatusId: string;
}

export function InlineStatusChanger({ personId, personName, moduleId, currentStatusId }: Props) {
  const { updatePersonStatus } = useHR();
  const [isOpen, setIsOpen] = useState(false);

  const mod = getHRModule(moduleId);
  if (!mod) return null;

  const statuses = getModuleStatusOptions(moduleId);
  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const isComplete = currentStatus?.category === "complete" || currentStatusId?.includes("closed");
  const isTerminal = currentStatus?.category === "terminal";

  const handleChange = (newStatusId: string) => {
    if (newStatusId === currentStatusId) return;
    updatePersonStatus(personId, moduleId, newStatusId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded transition-all hover:opacity-80"
        style={{
          backgroundColor: currentStatus ? currentStatus.bgColor : "#F3F4F6",
          color: currentStatus ? currentStatus.color : "#9CA3AF",
          border: "none",
          cursor: "pointer",
        }}
      >
        {isComplete && <CheckCircle size={11} />}
        {isTerminal && <XCircle size={11} />}
        {currentStatus ? currentStatus.label : "Set Status"}
        <ChevronDown size={10} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="absolute right-0 top-full mt-1 w-[220px] rounded-lg border shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: "var(--card-bg, #FFFFFF)", borderColor: "var(--card-border, #E2E8F0)" }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Change Status
              </p>
            </div>
            <div className="max-h-[240px] overflow-y-auto py-1">
              {statuses.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleChange(s.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-gray-50"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span
                    className="text-[11px] font-medium flex-1"
                    style={{ color: s.id === currentStatusId ? s.color : "var(--topbar-title)" }}
                  >
                    {s.label}
                  </span>
                  {s.id === currentStatusId && (
                    <CheckCircle size={12} style={{ color: "#059669" }} />
                  )}
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}>
              <p className="text-[10px]" style={{ color: "#94A3B8" }}>
                {personName} · {mod.name}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
