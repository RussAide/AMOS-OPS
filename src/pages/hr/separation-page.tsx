import { useState } from "react";
import {
  Search,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  ChevronDown,
  Play,
  MessageSquare,
  DollarSign,
  LogOut,
  TrendingUp,
  Users,
} from "lucide-react";

interface SeparationRecord {
  id: number;
  employee: string;
  position: string;
  department: string;
  separationDate: string;
  type: string;
  status: string;
  exitInterview: string;
  exitInterviewDate: string;
  finalPayStatus: string;
  noticePeriod: string;
  reason: string;
}

const demoData: SeparationRecord[] = [
  {
    id: 1,
    employee: "Jessica Williams",
    position: "Youth Support Specialist",
    department: "Clinical Services",
    separationDate: "2025-07-15",
    type: "Voluntary",
    status: "Pending",
    exitInterview: "Scheduled",
    exitInterviewDate: "2025-07-10",
    finalPayStatus: "Pending",
    noticePeriod: "2 weeks",
    reason: "Career advancement opportunity",
  },
  {
    id: 2,
    employee: "Robert Hayes",
    position: "Case Manager",
    department: "Case Management",
    separationDate: "2025-05-22",
    type: "Voluntary",
    status: "Completed",
    exitInterview: "Completed",
    exitInterviewDate: "2025-05-18",
    finalPayStatus: "Processed",
    noticePeriod: "4 weeks",
    reason: "Relocation to another state",
  },
  {
    id: 3,
    employee: "Linda Chen",
    position: "Administrative Assistant",
    department: "Administration",
    separationDate: "2025-06-05",
    type: "Involuntary",
    status: "Completed",
    exitInterview: "Waived",
    exitInterviewDate: "—",
    finalPayStatus: "Processed",
    noticePeriod: "N/A",
    reason: "Performance concerns",
  },
  {
    id: 4,
    employee: "Kevin Moore",
    position: "Mental Health Counselor",
    department: "Clinical Services",
    separationDate: "2025-04-18",
    type: "Voluntary",
    status: "Completed",
    exitInterview: "Completed",
    exitInterviewDate: "2025-04-15",
    finalPayStatus: "Processed",
    noticePeriod: "4 weeks",
    reason: "Pursuing further education",
  },
];

const kpiCards = [
  {
    label: "Pending",
    value: "1",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    label: "Completed 30d",
    value: "2",
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    label: "Exit Interviews",
    value: "3",
    icon: MessageSquare,
    color: "text-[#245C5A]",
    bg: "bg-[#245C5A]/10",
  },
  {
    label: "Turnover Rate",
    value: "12%",
    icon: TrendingUp,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Clock size={12} />
          Pending
        </span>
      );
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Completed
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

const getExitInterviewBadge = (status: string) => {
  switch (status) {
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CheckCircle size={12} />
          Completed
        </span>
      );
    case "Scheduled":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
          <Calendar size={12} />
          Scheduled
        </span>
      );
    case "Waived":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
          <XCircle size={12} />
          Waived
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
          {status}
        </span>
      );
  }
};

const getFinalPayBadge = (status: string) => {
  switch (status) {
    case "Processed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <DollarSign size={12} />
          Processed
        </span>
      );
    case "Pending":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
          <Clock size={12} />
          Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
          {status}
        </span>
      );
  }
};

export default function SeparationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredData = demoData.filter((record) => {
    const matchesSearch =
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "All" || record.type === typeFilter;
    const matchesStatus =
      statusFilter === "All" || record.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#245C5A]">
            <UserX className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Separation Management
            </h1>
            <p className="text-sm text-gray-500">
              Manage employee separations, exit interviews, final pay processing,
              and turnover tracking
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
              placeholder="Search employee, position, department..."
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
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-[#245C5A] focus:ring-1 focus:ring-[#245C5A]"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Play size={14} />
            Process Separation
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#245C5A] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a3a38]">
            <Calendar size={14} />
            Schedule Exit Interview
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Exit Interview</th>
                <th className="px-4 py-3">Final Pay</th>
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
                    No separation records found matching your criteria.
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
                    <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {getExitInterviewBadge(record.exitInterview)}
                        {record.exitInterviewDate !== "—" && (
                          <span className="text-[11px] text-gray-400">
                            {record.exitInterviewDate}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getFinalPayBadge(record.finalPayStatus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="View Details"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                        >
                          <FileText size={15} />
                        </button>
                        {record.status === "Pending" && (
                          <>
                            <button
                              title="Process Separation"
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                            >
                              <Play size={15} />
                            </button>
                            <button
                              title="Schedule Exit Interview"
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]"
                            >
                              <Calendar size={15} />
                            </button>
                          </>
                        )}
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

      {/* Additional Info Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#245C5A]" />
            <h4 className="text-xs font-semibold text-gray-900">
              Notice Period Overview
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {demoData.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-600">{r.employee}</span>
                <span className="font-medium text-gray-900">
                  {r.noticePeriod}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#245C5A]" />
            <h4 className="text-xs font-semibold text-gray-900">
              Separation Reasons
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {demoData.map((r) => (
              <div key={r.id} className="text-xs">
                <span className="font-medium text-gray-700">{r.employee}:</span>
                <span className="ml-1 text-gray-500">{r.reason}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#245C5A]" />
            <h4 className="text-xs font-semibold text-gray-900">
              Turnover Insights
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Clinical Services</span>
              <span className="font-medium text-red-600">2 separations</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Case Management</span>
              <span className="font-medium text-gray-900">1 separation</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Administration</span>
              <span className="font-medium text-gray-900">1 separation</span>
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
              Primary driver: Career advancement (50%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
