import { useState, useMemo } from "react";
import {
  Users, UserCheck, UserX, UserPlus, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Phone, Mail, Building2,
  Calendar, ShieldAlert, ShieldCheck, Shield,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface PersonnelRecord {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  department: string;
  status: "active" | "on_leave" | "terminated" | "new_hire";
  hireDate: string;
  email: string;
  phone: string;
  supervisor: string;
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  active:     { label: "Active",      color: "#059669", bg: "#ECFDF5", icon: ShieldCheck },
  on_leave:   { label: "On Leave",    color: "#D97706", bg: "#FFFBEB", icon: ShieldAlert },
  terminated: { label: "Terminated",  color: "#DC2626", bg: "#FEF2F2", icon: Shield },
  new_hire:   { label: "New Hire",    color: "#2563EB", bg: "#EFF6FF", icon: UserPlus },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_PERSONNEL: PersonnelRecord[] = [
  { id: "1", employeeId: "AMOS-1001", name: "Sarah Johnson", role: "Registered Nurse", department: "Clinical", status: "active", hireDate: "2023-01-15", email: "s.johnson@amos.org", phone: "(512) 555-0101", supervisor: "Dr. Sarah Chen" },
  { id: "2", employeeId: "AMOS-1002", name: "Michael Chen", role: "LPHA Therapist", department: "Clinical", status: "active", hireDate: "2022-08-01", email: "m.chen@amos.org", phone: "(512) 555-0102", supervisor: "Dr. Sarah Chen" },
  { id: "3", employeeId: "AMOS-1003", name: "David Park", role: "QMHP Specialist", department: "Clinical", status: "on_leave", hireDate: "2021-03-20", email: "d.park@amos.org", phone: "(512) 555-0103", supervisor: "Dr. Sarah Chen" },
  { id: "4", employeeId: "AMOS-1004", name: "Emily Roberts", role: "Youth Care Worker", department: "GRO", status: "active", hireDate: "2024-02-10", email: "e.roberts@amos.org", phone: "(512) 555-0104", supervisor: "James Rodriguez" },
  { id: "5", employeeId: "AMOS-1005", name: "James Wilson", role: "Residential Counselor", department: "GRO", status: "active", hireDate: "2023-06-15", email: "j.wilson@amos.org", phone: "(512) 555-0105", supervisor: "James Rodriguez" },
  { id: "6", employeeId: "AMOS-1006", name: "Lisa Thompson", role: "Case Manager", department: "BHC", status: "new_hire", hireDate: "2025-06-01", email: "l.thompson@amos.org", phone: "(512) 555-0106", supervisor: "Marcus Williams" },
  { id: "7", employeeId: "AMOS-1007", name: "Marcus Lee", role: "Billing Specialist", department: "Revenue", status: "active", hireDate: "2020-11-01", email: "m.lee@amos.org", phone: "(512) 555-0107", supervisor: "Rachel Kim" },
  { id: "8", employeeId: "AMOS-1008", name: "Aisha Patel", role: "HR Coordinator", department: "HR", status: "active", hireDate: "2021-09-10", email: "a.patel@amos.org", phone: "(512) 555-0108", supervisor: "Aisha Patel" },
  { id: "9", employeeId: "AMOS-1009", name: "Carlos Mendez", role: "Facilities Tech", department: "GAD", status: "active", hireDate: "2023-04-22", email: "c.mendez@amos.org", phone: "(512) 555-0109", supervisor: "Carlos Mendez" },
  { id: "10", employeeId: "AMOS-1010", name: "Rachel Kim", role: "Revenue Manager", department: "Revenue", status: "on_leave", hireDate: "2022-01-05", email: "r.kim@amos.org", phone: "(512) 555-0110", supervisor: "Marcus Williams" },
  { id: "11", employeeId: "AMOS-1011", name: "James Rodriguez", role: "RC Supervisor", department: "GRO", status: "active", hireDate: "2019-07-15", email: "j.rodriguez@amos.org", phone: "(512) 555-0111", supervisor: "Marcus Williams" },
  { id: "12", employeeId: "AMOS-1012", name: "Lilian Ike", role: "Nurse Manager", department: "Clinical", status: "new_hire", hireDate: "2025-06-15", email: "l.ike@amos.org", phone: "(512) 555-0112", supervisor: "Dr. Sarah Chen" },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "name" | "department" | "status" | "hireDate" | "role";
type SortDir = "asc" | "desc";

export default function PersonnelFilesPage() {
  const [personnel] = useState<PersonnelRecord[]>(DEMO_PERSONNEL);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedPerson, setSelectedPerson] = useState<PersonnelRecord | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...personnel];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.employeeId.toLowerCase().includes(q) ||
        x.role.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.department.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (deptFilter !== "all") r = r.filter((x) => x.department === deptFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "department": cmp = a.department.localeCompare(b.department); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "hireDate": cmp = new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime(); break;
        case "role": cmp = a.role.localeCompare(b.role); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [personnel, searchQuery, statusFilter, deptFilter, sortField, sortDir]);

  const kpiCounts = useMemo(() => ({
    total: personnel.length,
    active: personnel.filter((r) => r.status === "active").length,
    onLeave: personnel.filter((r) => r.status === "on_leave").length,
    newHires: personnel.filter((r) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(r.hireDate) >= thirtyDaysAgo || r.status === "new_hire";
    }).length,
  }), [personnel]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
      : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
  };

  const departments = [...new Set(personnel.map((p) => p.department))];
  const hasFilters = searchQuery || statusFilter !== "all" || deptFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Users size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Personnel Files</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Manage employee records, roles, departments, and employment status
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <UserPlus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Staff", value: kpiCounts.total, color: "#2563EB", bg: "#EFF6FF", icon: Users },
          { label: "Active", value: kpiCounts.active, color: "#059669", bg: "#ECFDF5", icon: UserCheck },
          { label: "On Leave", value: kpiCounts.onLeave, color: "#D97706", bg: "#FFFBEB", icon: UserX },
          { label: "New Hires (30d)", value: kpiCounts.newHires, color: "#4F46E5", bg: "#EEF2FF", icon: UserPlus },
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
            placeholder="Search name, ID, role, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Departments</option>
            {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDeptFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {personnel.length} staff</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("name")}>
                  <span className="flex items-center">Name <SortIcon field="name" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Employee ID</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("role")}>
                  <span className="flex items-center">Role <SortIcon field="role" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("department")}>
                  <span className="flex items-center">Department <SortIcon field="department" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status <SortIcon field="status" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("hireDate")}>
                  <span className="flex items-center">Hire Date <SortIcon field="hireDate" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stCfg = STATUS_CONFIG[p.status];
                const StatusIcon = stCfg.icon;
                return (
                  <tr key={p.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{p.email}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-mono font-medium" style={{ color: "var(--topbar-subtitle)" }}>{p.employeeId}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{p.role}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Building2 size={10} /> {p.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {p.hireDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedPerson(p)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Users size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No personnel match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDeptFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedPerson.name}</h3>
                <button onClick={() => setSelectedPerson(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <Users size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[12px]"><Building2 size={12} style={{ color: "var(--topbar-subtitle)" }} /> <span className="font-medium">{selectedPerson.role}</span> — {selectedPerson.department}</div>
                <div className="flex items-center gap-2 text-[12px]"><Mail size={12} style={{ color: "var(--topbar-subtitle)" }} /> {selectedPerson.email}</div>
                <div className="flex items-center gap-2 text-[12px]"><Phone size={12} style={{ color: "var(--topbar-subtitle)" }} /> {selectedPerson.phone}</div>
                <div className="flex items-center gap-2 text-[12px]"><Calendar size={12} style={{ color: "var(--topbar-subtitle)" }} /> Hired: {selectedPerson.hireDate}</div>
                <div className="flex items-center gap-2 text-[12px]"><UserCheck size={12} style={{ color: "var(--topbar-subtitle)" }} /> Supervisor: {selectedPerson.supervisor}</div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedPerson.status].bg, color: STATUS_CONFIG[selectedPerson.status].color }}>
                  {STATUS_CONFIG[selectedPerson.status].label}
                </span>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
