import { useState, useMemo } from "react";
import {
  Award, CheckCircle2, Clock, AlertTriangle, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Download, Plus,
  Calendar, FileCheck, X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface CredentialRecord {
  id: string;
  employee: string;
  employeeId: string;
  credentialType: string;
  licenseNumber: string;
  issueDate: string;
  expiryDate: string;
  status: "valid" | "expiring_soon" | "expired";
  daysLeft: number;
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  valid:         { label: "Valid",         color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  expiring_soon: { label: "Expiring (90d)", color: "#D97706", bg: "#FFFBEB", icon: Clock },
  expired:       { label: "Expired",       color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_CREDENTIALS: CredentialRecord[] = [
  { id: "1", employee: "Synthetic Staff 01", employeeId: "AMOS-1001", credentialType: "RN License", licenseNumber: "RN-2019-TX-4821", issueDate: "2023-01-15", expiryDate: "2026-01-15", status: "valid", daysLeft: 190 },
  { id: "2", employee: "Michael Chen", employeeId: "AMOS-1002", credentialType: "LPHA Certification", licenseNumber: "LPHA-2020-1138", issueDate: "2024-03-10", expiryDate: "2026-03-10", status: "valid", daysLeft: 254 },
  { id: "3", employee: "Synthetic Staff 04", employeeId: "AMOS-1003", credentialType: "QMHP Credential", licenseNumber: "QMHP-2021-2056", issueDate: "2024-06-01", expiryDate: "2025-08-01", status: "expiring_soon", daysLeft: 42 },
  { id: "4", employee: "Synthetic-Person-037 Roberts", employeeId: "AMOS-1004", credentialType: "CPI Certification", licenseNumber: "CPI-2023-7712", issueDate: "2023-11-20", expiryDate: "2025-07-15", status: "expiring_soon", daysLeft: 25 },
  { id: "5", employee: "Synthetic Staff 09", employeeId: "AMOS-1005", credentialType: "First Aid / CPR", licenseNumber: "CPR-2024-AHA-3391", issueDate: "2024-08-05", expiryDate: "2026-08-05", status: "valid", daysLeft: 422 },
  { id: "6", employee: "Lisa Thompson", employeeId: "AMOS-1006", credentialType: "TB Test Result", licenseNumber: "TB-2025-0442", issueDate: "2025-01-10", expiryDate: "2026-01-10", status: "valid", daysLeft: 185 },
  { id: "7", employee: "Synthetic-Person-001 Lee", employeeId: "AMOS-1007", credentialType: "RN License", licenseNumber: "RN-2018-TX-3356", issueDate: "2022-09-01", expiryDate: "2025-05-15", status: "expired", daysLeft: -30 },
  { id: "8", employee: "Aisha Patel", employeeId: "AMOS-1008", credentialType: "LPHA Certification", licenseNumber: "LPHA-2022-4489", issueDate: "2025-02-15", expiryDate: "2027-02-15", status: "valid", daysLeft: 590 },
  { id: "9", employee: "Synthetic-Person-004 Mendez", employeeId: "AMOS-1009", credentialType: "EPA 608 Certification", licenseNumber: "EPA-2024-5561", issueDate: "2024-04-01", expiryDate: "2026-04-01", status: "valid", daysLeft: 270 },
  { id: "10", employee: "Rachel Kim", employeeId: "AMOS-1010", credentialType: "CPA License", licenseNumber: "CPA-TX-2019-7782", issueDate: "2023-07-01", expiryDate: "2025-06-30", status: "expiring_soon", daysLeft: 10 },
  { id: "11", employee: "Demo Clinical Lead", employeeId: "AMOS-1011", credentialType: "LVN License", licenseNumber: "LVN-2024-TX-9912", issueDate: "2024-09-15", expiryDate: "2026-09-15", status: "valid", daysLeft: 447 },
  { id: "12", employee: "James Rodriguez", employeeId: "AMOS-1012", credentialType: "CRC Certification", licenseNumber: "CRC-2022-1156", issueDate: "2024-01-20", expiryDate: "2026-01-20", status: "valid", daysLeft: 195 },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "employee" | "credentialType" | "issueDate" | "expiryDate" | "status" | "daysLeft";
type SortDir = "asc" | "desc";

export default function CredentialTrackerPage() {
  const [credentials] = useState<CredentialRecord[]>(DEMO_CREDENTIALS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("expiryDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedCred, setSelectedCred] = useState<CredentialRecord | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...credentials];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.employee.toLowerCase().includes(q) ||
        x.credentialType.toLowerCase().includes(q) ||
        x.licenseNumber.toLowerCase().includes(q) ||
        x.employeeId.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "employee": cmp = a.employee.localeCompare(b.employee); break;
        case "credentialType": cmp = a.credentialType.localeCompare(b.credentialType); break;
        case "issueDate": cmp = new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime(); break;
        case "expiryDate": cmp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "daysLeft": cmp = a.daysLeft - b.daysLeft; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [credentials, searchQuery, statusFilter, sortField, sortDir]);

  const kpiCounts = useMemo(() => ({
    total: credentials.length,
    valid: credentials.filter((r) => r.status === "valid").length,
    expiring: credentials.filter((r) => r.status === "expiring_soon").length,
    expired: credentials.filter((r) => r.status === "expired").length,
  }), [credentials]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
      : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
  };

  const hasFilters = searchQuery || statusFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <FileCheck size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Credential Tracker</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Monitor licenses, certifications, and credential expiry across all staff
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={14} /> Add Credential
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Creds", value: kpiCounts.total, color: "#2563EB", bg: "#EFF6FF", icon: Award },
          { label: "Valid", value: kpiCounts.valid, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
          { label: "Expiring (90d)", value: kpiCounts.expiring, color: "#D97706", bg: "#FFFBEB", icon: Clock },
          { label: "Expired", value: kpiCounts.expired, color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
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
            placeholder="Search employee, credential, license #..."
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
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {credentials.length} credentials</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("employee")}>
                  <span className="flex items-center">Employee {renderSortIcon("employee")}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("credentialType")}>
                  <span className="flex items-center">Credential Type {renderSortIcon("credentialType")}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>License #</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("issueDate")}>
                  <span className="flex items-center">Issue Date {renderSortIcon("issueDate")}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("expiryDate")}>
                  <span className="flex items-center">Expiry Date {renderSortIcon("expiryDate")}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status {renderSortIcon("status")}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stCfg = STATUS_CONFIG[c.status];
                const StatusIcon = stCfg.icon;
                return (
                  <tr key={c.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{c.employee}</p>
                      <p className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{c.employeeId}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.credentialType}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{c.licenseNumber}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {c.issueDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: c.daysLeft <= 0 ? "#DC2626" : c.daysLeft <= 30 ? "#D97706" : "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {c.expiryDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedCred(c)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Award size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No credentials match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCred && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedCred.credentialType}</h3>
                <button onClick={() => setSelectedCred(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Employee</span>
                  <span className="text-[12px] font-medium">{selectedCred.employee} ({selectedCred.employeeId})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>License #</span>
                  <span className="text-[11px] font-mono">{selectedCred.licenseNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Issue Date</span>
                  <span className="text-[11px]">{selectedCred.issueDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Expiry Date</span>
                  <span className="text-[11px]" style={{ color: selectedCred.daysLeft <= 0 ? "#DC2626" : selectedCred.daysLeft <= 30 ? "#D97706" : "inherit" }}>{selectedCred.expiryDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Days Remaining</span>
                  <span className="text-[14px] font-bold" style={{ color: selectedCred.daysLeft <= 0 ? "#DC2626" : selectedCred.daysLeft <= 30 ? "#D97706" : "#059669" }}>
                    {selectedCred.daysLeft <= 0 ? `Expired (${Math.abs(selectedCred.daysLeft)}d)` : `${selectedCred.daysLeft} days`}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedCred.status].bg, color: STATUS_CONFIG[selectedCred.status].color }}>
                  {STATUS_CONFIG[selectedCred.status].label}
                </span>
              </div>
              <button onClick={() => setSelectedCred(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
