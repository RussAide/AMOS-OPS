import React, { useState } from "react";
import {
  Search,
  Filter,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  Download,
} from "lucide-react";

const credentialsData = [
  {
    employee: "Sarah Johnson",
    type: "RN License",
    licenseNumber: "RN-2019-TX-4821",
    issueDate: "2023-01-15",
    expiryDate: "2026-01-15",
    status: "Valid",
    daysLeft: 365,
  },
  {
    employee: "Michael Chen",
    type: "LPHA Certification",
    licenseNumber: "LPHA-2020-1138",
    issueDate: "2024-03-10",
    expiryDate: "2026-03-10",
    status: "Valid",
    daysLeft: 420,
  },
  {
    employee: "David Park",
    type: "QMHP Credential",
    licenseNumber: "QMHP-2021-2056",
    issueDate: "2024-06-01",
    expiryDate: "2025-06-01",
    status: "Valid",
    daysLeft: 182,
  },
  {
    employee: "Emily Roberts",
    type: "CPI Certification",
    licenseNumber: "CPI-2023-7712",
    issueDate: "2023-11-20",
    expiryDate: "2025-11-20",
    status: "Expiring Soon",
    daysLeft: 14,
  },
  {
    employee: "James Wilson",
    type: "First Aid / CPR",
    licenseNumber: "CPR-2024-AHA-3391",
    issueDate: "2024-08-05",
    expiryDate: "2026-08-05",
    status: "Valid",
    daysLeft: 548,
  },
  {
    employee: "Lisa Thompson",
    type: "TB Test Result",
    licenseNumber: "TB-2025-0442",
    issueDate: "2025-01-10",
    expiryDate: "2026-01-10",
    status: "Valid",
    daysLeft: 360,
  },
  {
    employee: "Marcus Lee",
    type: "RN License",
    licenseNumber: "RN-2018-TX-3356",
    issueDate: "2022-09-01",
    expiryDate: "2025-06-01",
    status: "Expired",
    daysLeft: 0,
  },
  {
    employee: "Aisha Patel",
    type: "LPHA Certification",
    licenseNumber: "LPHA-2022-4489",
    issueDate: "2025-02-15",
    expiryDate: "2027-02-15",
    status: "Valid",
    daysLeft: 730,
  },
];

const kpiData = [
  {
    label: "Total Credentials",
    value: 48,
    icon: Award,
    color: "text-[#7EC8CA]",
    bg: "bg-[#7EC8CA]/10",
  },
  {
    label: "Valid",
    value: 42,
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    label: "Expiring 30d",
    value: 2,
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    label: "Expired",
    value: 1,
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
];

export default function CredentialsTrackerPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = credentialsData.filter((row) => {
    const matchSearch =
      row.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "All" || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "Valid":
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
      case "Expiring Soon":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
      case "Expired":
        return "bg-red-500/15 text-red-400 border border-red-500/20";
      default:
        return "bg-gray-500/15 text-gray-400 border border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1515] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "#7EC8CA" }}
        >
          Credential Tracker
        </h1>
        <p className="text-gray-400 text-sm">
          Monitor and manage employee licenses, certifications, and credentials
          across the organization. Track expiry dates and renewal status in
          real-time.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiData.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-5 flex items-center gap-4"
            style={{
              backgroundColor: "#132c2b",
              borderColor: "rgba(126,200,202,0.15)",
            }}
          >
            <div className={`p-3 rounded-lg ${kpi.bg}`}>
              <kpi.icon size={22} className={kpi.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {kpi.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="rounded-xl border p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between"
        style={{
          backgroundColor: "#132c2b",
          borderColor: "rgba(126,200,202,0.15)",
        }}
      >
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search employee, credential, license #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a1515] text-gray-200 text-sm rounded-lg pl-9 pr-3 py-2.5 border outline-none focus:ring-2"
              style={{ borderColor: "rgba(126,200,202,0.2)" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a1515] text-gray-200 text-sm rounded-lg px-3 py-2.5 border outline-none focus:ring-2"
            style={{ borderColor: "rgba(126,200,202,0.2)" }}
          >
            <option value="All">All Status</option>
            <option value="Valid">Valid</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: "#245C5A", borderColor: "rgba(126,200,202,0.2)" }}>
            <Plus size={16} />
            Add Credential
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <RefreshCw size={16} />
            Renew
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: "#132c2b",
          borderColor: "rgba(126,200,202,0.15)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "rgba(126,200,202,0.15)" }}
              >
                {[
                  "Employee",
                  "Credential Type",
                  "License Number",
                  "Issue Date",
                  "Expiry Date",
                  "Status",
                  "Days Left",
                ].map((h) => (
                  <th
                    key={h}
                    className="py-3.5 px-4 font-semibold text-gray-300 uppercase text-xs tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(126,200,202,0.1)" }}>
              {filtered.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-[#1a3a38]/50 transition-colors"
                >
                  <td className="py-3.5 px-4 font-medium text-gray-200">
                    {row.employee}
                  </td>
                  <td className="py-3.5 px-4 text-gray-300">{row.type}</td>
                  <td className="py-3.5 px-4 text-gray-400 font-mono text-xs">
                    {row.licenseNumber}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {row.issueDate}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {row.expiryDate}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}
                    >
                      {row.status === "Valid" && (
                        <CheckCircle size={12} />
                      )}
                      {row.status === "Expiring Soon" && (
                        <Clock size={12} />
                      )}
                      {row.status === "Expired" && (
                        <AlertTriangle size={12} />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {row.status === "Expired" ? (
                      <span className="text-red-400 font-semibold">
                        Expired
                      </span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          row.daysLeft <= 30
                            ? "text-amber-400"
                            : "text-gray-300"
                        }`}
                      >
                        {row.daysLeft}d
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No credentials match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
