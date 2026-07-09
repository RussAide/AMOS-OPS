import { useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, UserCheck, FileCheck, Award } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface RTDPanelProps {
  personId?: string;
}

export function ReleaseToDutyPanel({ personId }: RTDPanelProps) {
  const [selectedPerson, setSelectedPerson] = useState(personId ?? "");
  const { data: rtd } = trpc.m1.checkReleaseToDuty.useQuery(
    { personId: selectedPerson },
    { enabled: !!selectedPerson }
  );

  if (!rtd) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} style={{ color: "#245C5A" }} />
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Release-to-Duty Gate</h3>
        </div>
        <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Select a person to check clearance status.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border" style={{ borderColor: rtd.isClear ? "#059669" : "#D97706", backgroundColor: rtd.isClear ? "#05966908" : "#D9770608" }}>
      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: rtd.isClear ? "#05966930" : "#D9770630" }}>
        {rtd.isClear ? <CheckCircle size={16} style={{ color: "#059669" }} /> : <AlertTriangle size={16} style={{ color: "#D97706" }} />}
        <h3 className="text-[13px] font-semibold" style={{ color: rtd.isClear ? "#059669" : "#D97706" }}>
          {rtd.isClear ? "CLEARED for Duty" : "NOT Cleared"}
        </h3>
      </div>

      <div className="p-3 space-y-2">
        {/* Modules */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={12} style={{ color: "var(--topbar-subtitle)" }} />
            <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Modules</span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: rtd.modules.total > 0 && rtd.modules.completed >= rtd.modules.total ? "#059669" : "#D97706" }}>
            {rtd.modules.completed}/{rtd.modules.total}
          </span>
        </div>

        {/* Credentials */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck size={12} style={{ color: "var(--topbar-subtitle)" }} />
            <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Credentials</span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: rtd.credentials.expired === 0 ? "#059669" : "#DC2626" }}>
            {rtd.credentials.expired === 0 ? "All Current" : `${rtd.credentials.expired} Expired`}
          </span>
        </div>

        {/* Evidence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} style={{ color: "var(--topbar-subtitle)" }} />
            <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Evidence</span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>
            {rtd.evidence.uploaded}/{rtd.evidence.total}
          </span>
        </div>

        {/* Blockers */}
        {rtd.blockers.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            {rtd.blockers.map((b: string, i: number) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5">
                <XCircle size={10} style={{ color: "#DC2626" }} />
                <span className="text-[10px]" style={{ color: "#DC2626" }}>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
