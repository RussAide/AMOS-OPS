import { useState, useMemo } from "react";
import {
  CloudSync, Users, CheckCircle2, Clock, AlertTriangle, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, RefreshCw, X,
  Mail, Shield, Calendar,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface EntraUser {
  id: string;
  name: string;
  email: string;
  adStatus: "synced" | "pending" | "error" | "disabled";
  lastSync: string;
  syncStatus: string;
  roles: string[];
  department: string;
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  synced:   { label: "Synced",   color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  pending:  { label: "Pending",  color: "#D97706", bg: "#FFFBEB", icon: Clock },
  error:    { label: "Error",    color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
  disabled: { label: "Disabled", color: "#6B7280", bg: "#F3F4F6", icon: Shield },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_USERS: EntraUser[] = [
  { id: "1", name: "Synthetic Staff 01", email: "s.johnson@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["Clinical-Staff"], department: "Clinical" },
  { id: "2", name: "Michael Chen", email: "m.chen@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["Clinical-Staff", "LPHA"], department: "Clinical" },
  { id: "3", name: "Synthetic Staff 04", email: "d.park@example.invalid", adStatus: "pending", lastSync: "2025-06-14T08:15:00Z", syncStatus: "Awaiting group assignment", roles: ["QMHP"], department: "Clinical" },
  { id: "4", name: "Synthetic-Person-037 Roberts", email: "e.roberts@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["GRO-Staff"], department: "GRO" },
  { id: "5", name: "Synthetic Staff 09", email: "j.wilson@example.invalid", adStatus: "error", lastSync: "2025-06-10T14:20:00Z", syncStatus: "License conflict detected", roles: ["GRO-Staff"], department: "GRO" },
  { id: "6", name: "Lisa Thompson", email: "l.thompson@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["BHC-Staff"], department: "BHC" },
  { id: "7", name: "Synthetic-Person-001 Lee", email: "m.lee@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["Revenue-Staff"], department: "Revenue" },
  { id: "8", name: "Aisha Patel", email: "a.patel@example.invalid", adStatus: "pending", lastSync: "2025-06-13T09:45:00Z", syncStatus: "Provisioning in progress", roles: ["HR-Admin"], department: "HR" },
  { id: "9", name: "Synthetic-Person-004 Mendez", email: "c.mendez@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["GAD-Staff"], department: "GAD" },
  { id: "10", name: "Rachel Kim", email: "r.kim@example.invalid", adStatus: "disabled", lastSync: "2025-05-01T11:00:00Z", syncStatus: "Account disabled", roles: ["Revenue-Manager"], department: "Revenue" },
  { id: "11", name: "James Rodriguez", email: "j.rodriguez@example.invalid", adStatus: "synced", lastSync: "2025-06-15T10:30:00Z", syncStatus: "Directory synced", roles: ["GRO-Supervisor"], department: "GRO" },
  { id: "12", name: "Demo Clinical Lead", email: "clinical.lead@amos-ops.invalid", adStatus: "error", lastSync: "2025-06-12T16:30:00Z", syncStatus: "Duplicate UPN found", roles: ["Clinical-Staff"], department: "Clinical" },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "name" | "email" | "adStatus" | "lastSync" | "department";
type SortDir = "asc" | "desc";

function renderSortIcon(field: SortField, activeField: SortField, direction: SortDir) {
  if (activeField !== field) {
    return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
  }
  return direction === "asc"
    ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
    : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
}

export default function EntraSyncPage() {
  const [users] = useState<EntraUser[]>(DEMO_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedUser, setSelectedUser] = useState<EntraUser | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...users];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.department.toLowerCase().includes(q) ||
        x.syncStatus.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.adStatus === statusFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "adStatus": cmp = a.adStatus.localeCompare(b.adStatus); break;
        case "lastSync": cmp = new Date(a.lastSync).getTime() - new Date(b.lastSync).getTime(); break;
        case "department": cmp = a.department.localeCompare(b.department); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [users, searchQuery, statusFilter, sortField, sortDir]);

  const kpiCounts = useMemo(() => ({
    total: users.length,
    synced: users.filter((r) => r.adStatus === "synced").length,
    pending: users.filter((r) => r.adStatus === "pending").length,
    errors: users.filter((r) => r.adStatus === "error").length,
  }), [users]);

  const hasFilters = searchQuery || statusFilter !== "all";

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <CloudSync size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Entra ID Sync</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Azure AD user provisioning, sync status, and directory management
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <RefreshCw size={14} /> Force Sync
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Users", value: kpiCounts.total, color: "#2563EB", bg: "#EFF6FF", icon: Users },
          { label: "Synced", value: kpiCounts.synced, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
          { label: "Pending", value: kpiCounts.pending, color: "#D97706", bg: "#FFFBEB", icon: Clock },
          { label: "Errors", value: kpiCounts.errors, color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                  <Icon size={16} style={{ color: kpi.color }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</span>
              </div>
              <p className="text-[24px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            placeholder="Search name, email, department, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Sync Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {users.length} users</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("name")}>
                  <span className="flex items-center">User {renderSortIcon("name", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("email")}>
                  <span className="flex items-center">Email {renderSortIcon("email", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("department")}>
                  <span className="flex items-center">Department {renderSortIcon("department", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("adStatus")}>
                  <span className="flex items-center">AD Status {renderSortIcon("adStatus", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("lastSync")}>
                  <span className="flex items-center">Last Sync {renderSortIcon("lastSync", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const stCfg = STATUS_CONFIG[u.adStatus];
                const StatusIcon = stCfg.icon;
                return (
                  <tr key={u.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{u.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {u.roles.map((role) => (
                          <span key={role} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>{role}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        <Mail size={10} /> {u.email}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium">{u.department}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {formatDate(u.lastSync)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedUser(u)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <CloudSync size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No users match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedUser.name}</h3>
                <button onClick={() => setSelectedUser(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Email</span>
                  <span className="text-[12px]">{selectedUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Department</span>
                  <span className="text-[12px]">{selectedUser.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>AD Status</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedUser.adStatus].bg, color: STATUS_CONFIG[selectedUser.adStatus].color }}>
                    {STATUS_CONFIG[selectedUser.adStatus].label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Last Sync</span>
                  <span className="text-[11px] font-mono">{formatDate(selectedUser.lastSync)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Sync Details</span>
                  <span className="text-[11px]">{selectedUser.syncStatus}</span>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Roles</span>
                  <div className="flex gap-1 mt-1">
                    {selectedUser.roles.map((role) => (
                      <span key={role} className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>{role}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
