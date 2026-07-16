import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, ClipboardCheck, AlertTriangle, FileWarning } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  low: "#2563EB", moderate: "#D97706", high: "#DC2626", critical: "#7F1D1D",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#2563EB", medium: "#D97706", high: "#DC2626", urgent: "#7F1D1D",
};

export function QAListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"audits" | "incidents" | "actions">("audits");

  const { data: audits } = trpc.qa.listAudits.useQuery();
  const { data: incidents } = trpc.qa.listIncidents.useQuery();
  const { data: actions } = trpc.qa.listCorrectiveActions.useQuery();

  const tabs = [
    { key: "audits" as const, label: `Audits (${audits?.length ?? 0})`, icon: ClipboardCheck },
    { key: "incidents" as const, label: `Incidents (${incidents?.length ?? 0})`, icon: AlertTriangle },
    { key: "actions" as const, label: `Corrective Actions (${actions?.length ?? 0})`, icon: FileWarning },
  ];

  return (
    
      <>

    
        <div className="px-4 md:px-6 pt-4">
        <div className="mb-6">
          <button onClick={() => navigate("/qa")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
            <ArrowLeft size={14} /> Back to QA Dashboard
          </button>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <ShieldCheck size={22} style={{ color: "#7C3AED" }} /> QA Registry
          </h1>
        </div>

        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-[13px] font-medium transition-all flex items-center gap-2"
              style={{ color: activeTab === tab.key ? "#7C3AED" : "var(--topbar-subtitle)", borderBottom: `2px solid ${activeTab === tab.key ? "#7C3AED" : "transparent"}`, marginBottom: "-1px" }}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "audits" && (
          <div className="space-y-3">
            {(!audits || audits.length === 0) && <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No audits found</p>}
            {audits?.map((audit) => (
              <div key={audit.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{audit.auditNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: audit.status === "completed" || audit.status === "closed" ? "#D1FAE5" : audit.status === "in_progress" ? "#DBEAFE" : "#FEF3C7", color: audit.status === "completed" || audit.status === "closed" ? "#059669" : audit.status === "in_progress" ? "#2563EB" : "#D97706" }}>
                      {audit.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>{audit.auditType}</span>
                  </div>
                  {audit.score !== null && audit.score !== undefined && (
                    <span className="text-[16px] font-bold" style={{ color: audit.score >= 95 ? "#059669" : audit.score >= 85 ? "#D97706" : "#DC2626" }}>{audit.score}%</span>
                  )}
                </div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{audit.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{audit.scope}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="space-y-3">
            {(!incidents || incidents.length === 0) && <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No incidents found</p>}
            {incidents?.map((inc) => (
              <div key={inc.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{inc.incidentNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (SEVERITY_COLORS[inc.severity] ?? "#6B7280") + "15", color: SEVERITY_COLORS[inc.severity] ?? "#6B7280" }}>
                      {inc.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: inc.status === "resolved" || inc.status === "closed" ? "#D1FAE5" : inc.status === "under_investigation" ? "#FEF3C7" : "#FEE2E2", color: inc.status === "resolved" || inc.status === "closed" ? "#059669" : inc.status === "under_investigation" ? "#D97706" : "#DC2626" }}>
                      {inc.status}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{new Date(inc.occurredAt).toLocaleDateString()}</span>
                </div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{inc.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{inc.description}</p>
                {inc.resolutionNotes && <p className="text-[11px] mt-2" style={{ color: "#059669" }}>Resolution: {inc.resolutionNotes}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-3">
            {(!actions || actions.length === 0) && <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No corrective actions found</p>}
            {actions?.map((action) => (
              <div key={action.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{action.actionNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (PRIORITY_COLORS[action.priority] ?? "#6B7280") + "15", color: PRIORITY_COLORS[action.priority] ?? "#6B7280" }}>
                      {action.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: action.status === "completed" ? "#D1FAE5" : action.status === "overdue" ? "#FEE2E2" : "#FEF3C7", color: action.status === "completed" ? "#059669" : action.status === "overdue" ? "#DC2626" : "#D97706" }}>
                      {action.status}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                </div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{action.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{action.description}</p>
                {action.completionNotes && <p className="text-[11px] mt-2" style={{ color: "#059669" }}>Completion: {action.completionNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
  </>
  );
}

export default QAListPage;
