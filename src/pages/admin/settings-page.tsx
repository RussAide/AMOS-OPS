import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth, ROLE_DEFINITIONS } from "@/hooks/use-auth";
import { Settings, Users, ShieldCheck, KeyRound, UserCog, Trash2, CheckCircle, XCircle, Save } from "lucide-react";

const PERM_LABELS: Record<string, string> = {
  canViewHR: "View HR", canEditHR: "Edit HR",
  canViewCompliance: "View Compliance", canEditCompliance: "Edit Compliance",
  canViewClinical: "View Clinical", canViewOperations: "View Operations",
  canViewAdmin: "View Admin", canEditAdmin: "Edit Admin",
  canSupervise: "Can Supervise", canClearPersonnel: "Clear Personnel",
  canViewReports: "View Reports", canViewOnboarding: "View Onboarding",
  canManageDocuments: "Manage Documents",
};

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "access">("users");
  const { data: users, refetch } = trpc.auth.listUsers.useQuery();
  const updateMutation = trpc.auth.updateUser.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.auth.deleteUser.useMutation({ onSuccess: () => refetch() });

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ role: "", department: "" });

  const handleEdit = (u: any) => {
    setEditingUser(u.id);
    setEditForm({ role: u.role, department: u.department ?? "" });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, role: editForm.role, department: editForm.department || null });
    setEditingUser(null);
  };

  const handleToggleActive = (u: any) => {
    updateMutation.mutate({ id: u.id, isActive: !u.isActive });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this user permanently?")) deleteMutation.mutate({ id });
  };

  const isSuperAdmin = user?.role === "super-admin";

  return (
    
      <div className="px-4 md:px-6 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#374151" }}>
            <Settings size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Admin Settings</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              User management, roles, and access control
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          {(["users", "roles", "access"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg flex items-center gap-2"
              style={{ color: activeTab === tab ? "#245C5A" : "var(--topbar-subtitle)", borderBottom: activeTab === tab ? "2px solid #245C5A" : "2px solid transparent" }}>
              {tab === "users" && <Users size={14} />}
              {tab === "roles" && <ShieldCheck size={14} />}
              {tab === "access" && <KeyRound size={14} />}
              {tab}
            </button>
          ))}
        </div>

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>All Users</h3>
              <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>{(users ?? []).length} users</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Name</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Email</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Role</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Department</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u: any) => (
                    <tr key={u.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2 px-2 font-medium" style={{ color: "var(--topbar-title)" }}>{u.name}</td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>{u.email}</td>
                      <td className="py-2 px-2">
                        {editingUser === u.id ? (
                          <select className="text-[11px] rounded border px-1 py-0.5" style={{ borderColor: "var(--card-border)" }}
                            value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                            {ROLE_DEFINITIONS.map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: ROLE_DEFINITIONS.find(r => r.id === u.role)?.badgeColor + "20" ?? "#F3F4F6", color: ROLE_DEFINITIONS.find(r => r.id === u.role)?.badgeColor ?? "#6B7280" }}>
                            {ROLE_DEFINITIONS.find(r => r.id === u.role)?.label ?? u.role}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2" style={{ color: "var(--topbar-subtitle)" }}>
                        {editingUser === u.id ? (
                          <input className="text-[11px] rounded border px-1 py-0.5 w-24" style={{ borderColor: "var(--card-border)" }}
                            value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                        ) : (
                          u.department ?? "—"
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => handleToggleActive(u)} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium cursor-pointer"
                          style={{ backgroundColor: u.isActive ? "#DCFCE7" : "#FEE2E2", color: u.isActive ? "#059669" : "#DC2626" }}>
                          {u.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {u.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          {editingUser === u.id ? (
                            <button onClick={() => handleSave(u.id)} className="p-1 rounded" style={{ backgroundColor: "#DCFCE7" }}>
                              <Save size={12} style={{ color: "#059669" }} />
                            </button>
                          ) : (
                            <button onClick={() => handleEdit(u)} className="p-1 rounded" style={{ backgroundColor: "#F3F4F6" }}>
                              <UserCog size={12} style={{ color: "#6B7280" }} />
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button onClick={() => handleDelete(u.id)} className="p-1 rounded" style={{ backgroundColor: "#FEE2E2" }}>
                              <Trash2 size={12} style={{ color: "#DC2626" }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!users || users.length === 0) && (
                    <tr><td colSpan={6} className="py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROLES TAB */}
        {activeTab === "roles" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>BHC/GRO Launch Staffing Plan Roles</h3>
              <p className="text-[12px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>22 positions mapped from Adolbi Care staffing plan. Super Admin is the account owner.</p>
            </div>
            {ROLE_DEFINITIONS.map((role) => (
              <div key={role.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: role.badgeColor }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{role.label}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: role.badgeColor + "15", color: role.badgeColor }}>{role.id}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{role.department} · {role.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ACCESS CONTROL TAB */}
        {activeTab === "access" && (
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Permission Matrix</h3>
            <p className="text-[12px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>Read-only view of permissions per role. To modify, contact Super Admin.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)" }}>
                    <th className="text-left py-1 px-1 font-semibold sticky left-0 bg-white" style={{ color: "var(--topbar-subtitle)", minWidth: 120 }}>Role</th>
                    {Object.values(PERM_LABELS).map((label) => (
                      <th key={label} className="text-center py-1 px-1 font-semibold" style={{ color: "var(--topbar-subtitle)", minWidth: 50, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLE_DEFINITIONS.slice(0, 12).map((role) => {
                    const perms = (user as any)?.permissions ?? {};
                    return (
                      <tr key={role.id} className="border-b" style={{ borderColor: "var(--card-border)" }}>
                        <td className="py-1 px-1 font-medium sticky left-0 bg-white" style={{ color: "var(--topbar-title)", fontSize: 11 }}>{role.label}</td>
                        {Object.keys(PERM_LABELS).map((key) => (
                          <td key={key} className="text-center py-1 px-1">
                            <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: "#E5E7EB" }} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );
}

export default SettingsPage;
