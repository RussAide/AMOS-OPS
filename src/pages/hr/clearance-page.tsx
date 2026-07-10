import React, { useState } from "react";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Upload,
  RefreshCw,
  ChevronDown,
  Lock,
} from "lucide-react";

interface ClearanceRecord {
  id: number;
  employee: string;
  position: string;
  clearanceLevel: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  documents: number;
}

const demoData: ClearanceRecord[] = [
  {
    id: 1,
    employee: "Sarah Mitchell",
    position: "Clinical Director",
    clearanceLevel: "Enhanced",
    issuedDate: "2022-03-15",
    expiryDate: "2025-03-15",
    status: "Active",
    documents: 4,
  },
  {
    id: 2,
    employee: "James Rodriguez",
    position: "Registered Nurse",
    clearanceLevel: "Standard",
    issuedDate: "2023-01-10",
    expiryDate: "2025-01-10",
    status: "Expiring Soon",
    documents: 3,
  },
  {
    id: 3,
    employee: "Emily Chen",
    position: "Mental Health Counselor",
    clearanceLevel: "Standard",
    issuedDate: "2023-06-22",
    expiryDate: "2026-06-22",
    status: "Active",
    documents: 2,
  },
  {
    id: 4,
    employee: "Michael Torres",
    position: "Youth Support Specialist",
    clearanceLevel: "Basic",
    issuedDate: "2024-02-01",
    expiryDate: "2025-02-01",
    status: "Expiring Soon",
    documents: 2,
  },
  {
    id: 5,
    employee: "Amanda Foster",
    position: "Case Manager",
    clearanceLevel: "Enhanced",
    issuedDate: "2021-08-18",
    expiryDate: "2024-08-18",
    status: "Expired",
    documents: 3,
  },
  {
    id: 6,
    employee: "David Kim",
    position: "Behavioral Therapist",
    clearanceLevel: "Standard",
    issuedDate: "2024-11-05",
    expiryDate: "2027-11-05",
    status: "Active",
    documents: 2,
  },
];

const kpiCards = [
  {
    label: "Active Clearances",
    value: "22",
    icon: Shield,
    color: "text-[#245C5A]",
    bg: "bg-[#245C5A]/10",
  },
  {
    label: "Expiring 90d",
    value: "3",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    label: "Expired",
    value: "1",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    label: "Pending",
    value: "2",
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Active
        </span>
      );
    case "Expiring Soon":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} />
          Expiring Soon
        </span>
      );
    case "Expired":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <XCircle size={12} />
          Expired
        </span>
      );
    case "Pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <Clock size={12} />
          Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {status}
        </span>
      );
  }
};

const getClearanceBadge = (level: string) => {
  switch (level) {
    case "Enhanced":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#245C5A] px-2 py-0.5 text-xs font-medium text-white">
          <Shield size={10} />
          Enhanced
        </span>
      );
    case "Standard":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#7EC8CA] px-2 py-0.5 text-xs font-medium text-[#1a3a38]">
          <Lock size={10} />
          Standard
        </span>
      );
    case "Basic":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
          Basic
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {level}
        </span>
      );
  }
};

export default function ClearancePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");

  const filteredData = demoData.filter((record) => {
    const matchesSearch =
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || record.status === statusFilter;
    const matchesLevel =
      levelFilter === "All" || record.clearanceLevel === levelFilter;
    return matchesSearch && matchesStatus && matchesLevel;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#245C5A]">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Security Clearance Tracker
            </h1>
            <p className="text-sm text-gray-500">
              Monitor and manage staff security clearances, expiry dates, and
              compliance documentation
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {kpi.value}
                </p>
              </div>
              <div className={`rounded-lg ${kpi.bg} p-2.5`}>
                <kpi.icon className={kpi.color} size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search employee or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A] sm:w-72"
            />
          </div>
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Pending">Pending</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
          </div>
          {/* Level Filter */}
          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A]"
            >
              <option value="All">All Levels</option>
              <option value="Basic">Basic</option>
              <option value="Standard">Standard</option>
              <option value="Enhanced">Enhanced</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Upload size={14} />
            Upload Document
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#245C5A] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a3a38]">
            <RefreshCw size={14} />
            Renew
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Clearance Level</th>
                <th className="px-4 py-3">Issued Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No clearance records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {record.employee}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {record.position}
                    </td>
                    <td className="px-4 py-3">
                      {getClearanceBadge(record.clearanceLevel)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {record.issuedDate}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {record.expiryDate}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <FileText size={14} />
                        {record.documents}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Upload Document"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                        >
                          <Upload size={15} />
                        </button>
                        <button
                          title="Renew Clearance"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                        >
                          <RefreshCw size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing {filteredData.length} of {demoData.length} records
          </p>
          <div className="flex gap-1">
            <button className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Previous
            </button>
            <button className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
