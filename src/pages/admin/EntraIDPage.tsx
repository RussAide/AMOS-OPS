import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Cloud, RefreshCw, Users, Shield, Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export function EntraIDPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "groups" | "history">("overview");
  const { data: status, refetch } = trpc.msgraph.status.useQuery();
  const { data: users } = trpc.msgraph.listUsers.useQuery();
  const { data: groups } = trpc.msgraph.listGroups.useQuery();
  const { data: history } = trpc.msgraph.syncHistory.useQuery();

  const syncMutation = trpc.msgraph.sync.useMutation({
    onSuccess: () => { refetch(); },
  });

  const isSyncing = syncMutation.isPending;

  const statusColors: Record<string, string> = {
    running: "#2563EB", completed: "#059669", failed: "#DC2626", partial: "#D97706",
  };

  return (
    
      <div className="px-4 md:px-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#0078D4" }}>
              <Cloud size={20} color="white" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Microsoft Entra ID</h1>
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
                {status ? `Tenant: ${status.tenant} · ${status.users.synced} users synced` : "Loading..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => syncMutation.mutate({ type: "full" })}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#0078D4" }}
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Full Sync"}
          </button>
        </div>

        {/* Stats Row */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} style={{ color: "#0078D4" }} />
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Users</span>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "#0078D4" }}>{status.users.synced} / {status.users.total}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} style={{ color: "#059669" }} />
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Groups</span>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "#059669" }}>{status.groups.synced} / {status.groups.total}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Cloud size={14} style={{ color: "#7C3AED" }} />
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Mode</span>
              </div>
              <p className="text-[18px] font-bold capitalize" style={{ color: "#7C3AED" }}>{status.syncMode}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} style={{ color: "var(--topbar-subtitle)" }} />
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Last Sync</span>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "var(--topbar-title)" }}>
                {status.lastSync ? new Date(status.lastSync.startedAt).toLocaleDateString() : "Never"}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b pb-0" style={{ borderColor: "var(--card-border)" }}>
          {(["overview", "users", "groups", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg transition-colors"
              style={{
                color: activeTab === tab ? "#0078D4" : "var(--topbar-subtitle)",
                borderBottom: activeTab === tab ? "2px solid #0078D4" : "2px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          {activeTab === "overview" && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Integration Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[12px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Tenant Domain</p>
                  <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>{status?.tenant ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[12px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Connection</p>
                  <p className="text-[14px] font-medium" style={{ color: "#059669" }}>
                    <CheckCircle size={12} className="inline mr-1" />{status?.connected ? "Connected" : "Disconnected"}
                  </p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[12px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Last Full Sync</p>
                  <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {status?.lastSync?.completedAt ? new Date(status.lastSync.completedAt).toLocaleString() : "Not yet synced"}
                  </p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[12px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Quick Actions</p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => syncMutation.mutate({ type: "users" })} disabled={isSyncing} className="text-[11px] px-2 py-1 rounded border disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>Sync Users</button>
                    <button onClick={() => syncMutation.mutate({ type: "groups" })} disabled={isSyncing} className="text-[11px] px-2 py-1 rounded border disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>Sync Groups</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Name</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>UPN</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Department</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Title</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u: any) => (
                    <tr key={u.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{u.display_name}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{u.user_principal_name}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{u.department}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{u.job_title}</td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
                          backgroundColor: u.sync_status === "active" ? "#DCFCE7" : "#FEF3C7",
                          color: u.sync_status === "active" ? "#059669" : "#D97706",
                        }}>
                          {u.sync_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!users || users.length === 0) && (
                    <tr><td colSpan={5} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No users synced yet. Click "Full Sync" to import from Entra ID.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "groups" && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Group Name</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Description</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Type</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {(groups ?? []).map((g: any) => (
                    <tr key={g.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{g.display_name}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{g.description}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{g.group_type}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-title)" }}>{g.member_count}</td>
                    </tr>
                  ))}
                  {(!groups || groups.length === 0) && (
                    <tr><td colSpan={4} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No groups synced yet. Click "Full Sync" to import from Entra ID.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Type</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Users</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Groups</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Started</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((h: any) => (
                    <tr key={h.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium capitalize" style={{ color: "var(--topbar-title)" }}>{h.sync_type}</td>
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-1">
                          {h.status === "completed" && <CheckCircle size={12} style={{ color: "#059669" }} />}
                          {h.status === "failed" && <XCircle size={12} style={{ color: "#DC2626" }} />}
                          {h.status === "partial" && <AlertTriangle size={12} style={{ color: "#D97706" }} />}
                          {h.status === "running" && <RefreshCw size={12} className="animate-spin" style={{ color: "#2563EB" }} />}
                          <span className="capitalize" style={{ color: statusColors[h.status] ?? "var(--topbar-subtitle)" }}>{h.status}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-title)" }}>{h.users_synced}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-title)" }}>{h.groups_synced}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{new Date(h.started_at).toLocaleString()}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{h.completed_at ? new Date(h.completed_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                  {(!history || history.length === 0) && (
                    <tr><td colSpan={6} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No sync history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}

export default EntraIDPage;
