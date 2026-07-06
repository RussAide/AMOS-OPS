import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { GitBranch, Play, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Shield, FileText, Activity } from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#D97706" },
  completed: { bg: "#DCFCE7", text: "#059669" },
  rejected: { bg: "#FEE2E2", text: "#DC2626" },
  approved: { bg: "#DCFCE7", text: "#059669" },
};

export function WorkflowPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "instances" | "approvals" | "audit">("rules");
  const { data: rules } = trpc.workflow.listRules.useQuery();
  const { data: instances } = trpc.workflow.listInstances.useQuery();
  const { data: approvals } = trpc.workflow.listPendingApprovals.useQuery();
  const { data: kpis } = trpc.workflow.dashboardKPIs.useQuery();
  const { data: auditLog } = trpc.workflow.auditLog.useQuery();

  const triggerMutation = trpc.workflow.trigger.useMutation({
    onSuccess: () => { window.location.reload(); },
  });

  const respondMutation = trpc.workflow.respondApproval.useMutation({
    onSuccess: () => { window.location.reload(); },
  });

  return (
    
      <div className="px-4 md:px-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7C3AED" }}>
              <GitBranch size={20} color="white" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Workflow Engine</h1>
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
                {kpis ? `${kpis.totalInstances} instances · ${kpis.pendingApprovals} pending approvals` : "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Total</p>
              <p className="text-[18px] font-bold" style={{ color: "#7C3AED" }}>{kpis.totalInstances}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Pending</p>
              <p className="text-[18px] font-bold" style={{ color: "#D97706" }}>{kpis.pendingInstances}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Completed</p>
              <p className="text-[18px] font-bold" style={{ color: "#059669" }}>{kpis.completedInstances}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Rejected</p>
              <p className="text-[18px] font-bold" style={{ color: "#DC2626" }}>{kpis.rejectedInstances}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Need Approval</p>
              <p className="text-[18px] font-bold" style={{ color: "#2563EB" }}>{kpis.pendingApprovals}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          {(["rules", "instances", "approvals", "audit"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg"
              style={{ color: activeTab === tab ? "#7C3AED" : "var(--topbar-subtitle)", borderBottom: activeTab === tab ? "2px solid #7C3AED" : "2px solid transparent" }}>
              {tab}
              {tab === "approvals" && approvals && approvals.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#DC2626", color: "white" }}>{approvals.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>

          {/* Rules Tab */}
          {activeTab === "rules" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Active Workflow Rules</h3>
                <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#F3E8FF", color: "#7C3AED" }}>{rules?.length ?? 0} rules</span>
              </div>
              {(rules ?? []).map((rule: any) => (
                <div key={rule.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rule.enabled ? "#F3E8FF" : "#F3F4F6" }}>
                    <Activity size={14} style={{ color: rule.enabled ? "#7C3AED" : "#9CA3AF" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{rule.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-medium" style={{ backgroundColor: rule.enabled ? "#DCFCE7" : "#F3F4F6", color: rule.enabled ? "#059669" : "#9CA3AF" }}>
                        {rule.enabled ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Event: {rule.event} · Actions: {rule.actions.length}</p>
                    <div className="flex gap-1 mt-1">
                      {rule.actions.map((a: any, i: number) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                          {a.type} → {a.target}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => triggerMutation.mutate({ ruleId: rule.id, triggerData: JSON.stringify({ demo: true, timestamp: Date.now() }) })}
                    disabled={triggerMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium border disabled:opacity-50 flex-shrink-0"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <Play size={12} /> Test
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Instances Tab */}
          {activeTab === "instances" && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Rule</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Event</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Started</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Triggered By</th>
                </tr></thead>
                <tbody>
                  {(instances ?? []).map((inst: any) => (
                    <tr key={inst.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{inst.rule_name}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{inst.event_type}</td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                          style={{ backgroundColor: STATUS_COLORS[inst.status]?.bg ?? "#F3F4F6", color: STATUS_COLORS[inst.status]?.text ?? "#6B7280" }}>
                          {inst.status}
                        </span>
                      </td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{inst.started_at ? new Date(inst.started_at).toLocaleString() : "—"}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{inst.triggered_by}</td>
                    </tr>
                  ))}
                  {(!instances || instances.length === 0) && (
                    <tr><td colSpan={5} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No workflow instances yet. Trigger a rule from the Rules tab.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Approvals Tab */}
          {activeTab === "approvals" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Pending Approvals</h3>
                <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>{approvals?.length ?? 0} pending</span>
              </div>
              {(approvals ?? []).map((app: any) => (
                <div key={app.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "#FCD34D" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEF3C7" }}>
                    <Shield size={14} style={{ color: "#D97706" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{app.rule_name}</p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Requires approval from: <strong>{app.approver_role}</strong> · Event: {app.event_type}</p>
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Requested: {app.requested_at ? new Date(app.requested_at).toLocaleString() : "—"}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => respondMutation.mutate({ approvalId: app.id, decision: "approved", approverId: "admin" })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white" style={{ backgroundColor: "#059669" }}>
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button onClick={() => respondMutation.mutate({ approvalId: app.id, decision: "rejected", approverId: "admin" })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white" style={{ backgroundColor: "#DC2626" }}>
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {(!approvals || approvals.length === 0) && (
                <div className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                  <CheckCircle size={24} className="mx-auto mb-2" style={{ color: "#059669" }} />
                  <p>No pending approvals. All caught up.</p>
                </div>
              )}
            </div>
          )}

          {/* Audit Tab */}
          {activeTab === "audit" && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Action</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actor</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Details</th>
                  <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Time</th>
                </tr></thead>
                <tbody>
                  {(auditLog ?? []).map((log: any) => (
                    <tr key={log.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{log.action}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{log.actor}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{log.details}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{log.created_at ? new Date(log.created_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                  {(!auditLog || auditLog.length === 0) && (
                    <tr><td colSpan={4} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No audit entries yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}

export default WorkflowPage;
