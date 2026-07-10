import React, { useState } from "react";
import {
  Search,
  History,
  LogOut,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  Eye,
  Download,
  FileText,
  TrendingDown,
  Users,
  Building2,
  BarChart3,
} from "lucide-react";

interface SeparationHistoryRecord {
  id: number;
  employee: string;
  position: string;
  department: string;
  separationDate: string;
  type: string;
  reason: string;
  tenure: string;
  rehireEligible: string;
  rehireDate: string;
  exitInterviewNotes: string;
}

const demoData: SeparationHistoryRecord[] = [
  {
    id: 1,
    employee: "Robert Hayes",
    position: "Case Manager",
    department: "Case Management",
    separationDate: "2025-05-22",
    type: "Voluntary",
    reason: "Relocation",
    tenure: "2 years 8 months",
    rehireEligible: "Yes",
    rehireDate: "Eligible now",
    exitInterviewNotes: "Positive. Would recommend employer.",
  },
  {
    id: 2,
    employee: "Linda Chen",
    position: "Administrative Assistant",
    department: "Administration",
    separationDate: "2025-06-05",
    type: "Involuntary",
    reason: "Performance",
    tenure: "11 months",
    rehireEligible: "No",
    rehireDate: "Not eligible",
    exitInterviewNotes: "N/A — Separation agreement signed.",
  },
  {
    id: 3,
    employee: "Kevin Moore",
    position: "Mental Health Counselor",
    department: "Clinical Services",
    separationDate: "2025-04-18",
    type: "Voluntary",
    reason: "Education",
    tenure: "3 years 2 months",
    rehireEligible: "Yes",
    rehireDate: "Eligible 2026-04",
    exitInterviewNotes: "Very positive. Returning to grad school.",
  },
  {
    id: 4,
    employee: "Angela Brooks",
    position: "Youth Support Specialist",
    department: "Clinical Services",
    separationDate: "2024-09-12",
    type: "Voluntary",
    reason: "Career Change",
    tenure: "1 year 5 months",
    rehireEligible: "Yes",
    rehireDate: "Eligible now",
    exitInterviewNotes: "Good feedback. Left on great terms.",
  },
  {
    id: 5,
    employee: "Steven Wright",
    position: "Behavioral Therapist",
    department: "Clinical Services",
    separationDate: "2024-11-30",
    type: "Involuntary",
    reason: "Attendance Policy",
    tenure: "8 months",
    rehireEligible: "Conditional",
    rehireDate: "Eligible 2026-05",
    exitInterviewNotes: "Attended counseling referral offered.",
  },
  {
    id: 6,
    employee: "Patricia Nguyen",
    position: "Registered Nurse",
    department: "Medical Services",
    separationDate: "2025-01-20",
    type: "Voluntary",
    reason: "Better Opportunity",
    tenure: "4 years 1 month",
    rehireEligible: "Yes",
    rehireDate: "Eligible now",
    exitInterviewNotes: "Excellent. Salary was primary factor.",
  },
];

const kpiCards = [
  {
    label: "Total 12m",
    value: "3",
    icon: Users,
    color: "text-[#245C5A]",
    bg: "bg-[#245C5A]/10",
  },
  {
    label: "Voluntary",
    value: "2",
    icon: LogOut,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Involuntary",
    value: "1",
    icon: UserX,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    label: "Avg Tenure",
    value: "18 months",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case "Voluntary":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <LogOut size={10} />
          Voluntary
        </span>
      );
    case "Involuntary":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          <UserX size={10} />
          Involuntary
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {type}
        </span>
      );
  }
};

const getReasonBadge = (reason: string) => {
  switch (reason) {
    case "Relocation":
      return (
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          Relocation
        </span>
      );
    case "Performance":
      return (
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Performance
        </span>
      );
    case "Education":
      return (
        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
          Education
        </span>
      );
    case "Career Change":
      return (
        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          Career Change
        </span>
      );
    case "Attendance Policy":
      return (
        <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
          Attendance
        </span>
      );
    case "Better Opportunity":
      return (
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Better Opportunity
        </span>
      );
    default:
      return (
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {reason}
        </span>
      );
  }
};

const getRehireBadge = (eligible: string) => {
  switch (eligible) {
    case "Yes":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Yes
        </span>
      );
    case "No":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <XCircle size={12} />
          No
        </span>
      );
    case "Conditional":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Clock size={12} />
          Conditional
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {eligible}
        </span>
      );
  }
};

export default function SeparationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");

  const filteredData = demoData.filter((record) => {
    const matchesSearch =
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "All" || record.type === typeFilter;
    const matchesDept =
      deptFilter === "All" || record.department === deptFilter;
    return matchesSearch && matchesType && matchesDept;
  });

  // Compute summary stats
  const voluntaryCount = demoData.filter((d) => d.type === "Voluntary").length;
  const involuntaryCount = demoData.filter(
    (d) => d.type === "Involuntary"
  ).length;
  const deptCounts: Record<string, number> = {};
  demoData.forEach((d) => {
    deptCounts[d.department] = (deptCounts[d.department] || 0) + 1;
  });
  const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#245C5A]">
            <History className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Separation History
            </h1>
            <p className="text-sm text-gray-500">
              Historical record of employee separations, reasons, tenure, and
              rehire eligibility status
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

      {/* Summary Insights Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-blue-50 p-2.5">
            <LogOut className="text-blue-600" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Voluntary Rate</p>
            <p className="text-lg font-bold text-gray-900">
              {Math.round((voluntaryCount / demoData.length) * 100)}%
            </p>
            <p className="text-[11px] text-gray-400">
              {voluntaryCount} of {demoData.length} separations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-red-50 p-2.5">
            <UserX className="text-red-600" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Involuntary Rate</p>
            <p className="text-lg font-bold text-gray-900">
              {Math.round((involuntaryCount / demoData.length) * 100)}%
            </p>
            <p className="text-[11px] text-gray-400">
              {involuntaryCount} of {demoData.length} separations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-[#245C5A]/10 p-2.5">
            <Building2 className="text-[#245C5A]" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Highest Turnover Dept</p>
            <p className="text-lg font-bold text-gray-900">
              {topDept?.[0] || "N/A"}
            </p>
            <p className="text-[11px] text-gray-400">
              {topDept?.[1] || 0} separations
            </p>
          </div>
        </div>
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
              placeholder="Search employee, position, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A] sm:w-72"
            />
          </div>
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A]"
            >
              <option value="All">All Types</option>
              <option value="Voluntary">Voluntary</option>
              <option value="Involuntary">Involuntary</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
          </div>
          {/* Department Filter */}
          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A]"
            >
              <option value="All">All Departments</option>
              <option value="Case Management">Case Management</option>
              <option value="Clinical Services">Clinical Services</option>
              <option value="Administration">Administration</option>
              <option value="Medical Services">Medical Services</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Eye size={14} />
            View Details
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#245C5A] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a3a38]">
            <Download size={14} />
            Export Report
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
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Separation Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Tenure</th>
                <th className="px-4 py-3">Rehire Eligible</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No separation history records found matching your criteria.
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
                    <td className="px-4 py-3 text-gray-600">
                      {record.department}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {record.separationDate}
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(record.type)}</td>
                    <td className="px-4 py-3">
                      {getReasonBadge(record.reason)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {record.tenure}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {getRehireBadge(record.rehireEligible)}
                        <span className="text-[11px] text-gray-400">
                          {record.rehireDate}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="View Details"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          title="Export Record"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                        >
                          <Download size={15} />
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

      {/* Bottom Insight Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown size={16} className="text-[#245C5A]" />
            <h4 className="text-xs font-semibold text-gray-900">
              Top Separation Reasons (12 months)
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-gray-600">Relocation</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[33%] rounded-full bg-blue-400" />
              </div>
              <span className="w-6 text-right text-xs font-medium text-gray-700">
                1
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-gray-600">Education</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[33%] rounded-full bg-purple-400" />
              </div>
              <span className="w-6 text-right text-xs font-medium text-gray-700">
                1
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-gray-600">
                Better Opportunity
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[33%] rounded-full bg-emerald-400" />
              </div>
              <span className="w-6 text-right text-xs font-medium text-gray-700">
                1
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-gray-600">Performance</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[33%] rounded-full bg-red-400" />
              </div>
              <span className="w-6 text-right text-xs font-medium text-gray-700">
                1
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-[#245C5A]" />
            <h4 className="text-xs font-semibold text-gray-900">
              Rehire Eligibility Summary
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md bg-emerald-50 p-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600" />
                <span className="text-xs font-medium text-emerald-800">
                  Eligible for Rehire
                </span>
              </div>
              <span className="text-sm font-bold text-emerald-800">
                {demoData.filter((d) => d.rehireEligible === "Yes").length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-amber-50 p-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-800">
                  Conditional
                </span>
              </div>
              <span className="text-sm font-bold text-amber-800">
                {demoData.filter((d) => d.rehireEligible === "Conditional").length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-red-50 p-2">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-red-600" />
                <span className="text-xs font-medium text-red-800">
                  Not Eligible
                </span>
              </div>
              <span className="text-sm font-bold text-red-800">
                {demoData.filter((d) => d.rehireEligible === "No").length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
