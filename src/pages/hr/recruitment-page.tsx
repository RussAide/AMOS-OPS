import React, { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  Download,
  UserPlus,
  Briefcase,
  Clock,
  CheckCircle,
  ChevronDown,
} from "lucide-react";

interface Requisition {
  id: number;
  position: string;
  department: string;
  postedDate: string;
  applicants: number;
  status: string;
  hiringManager: string;
}

const demoRequisitions: Requisition[] = [
  {
    id: 1,
    position: "Youth Care Worker",
    department: "GRO",
    postedDate: "2026-06-15",
    applicants: 5,
    status: "Active",
    hiringManager: "Sarah Martinez",
  },
  {
    id: 2,
    position: "Case Manager",
    department: "BHC",
    postedDate: "2026-06-20",
    applicants: 3,
    status: "Active",
    hiringManager: "David Chen",
  },
  {
    id: 3,
    position: "RN Charge Nurse",
    department: "GRO",
    postedDate: "2026-06-10",
    applicants: 2,
    status: "Interviewing",
    hiringManager: "Lisa Thompson",
  },
  {
    id: 4,
    position: "Facilities Technician",
    department: "GAD",
    postedDate: "2026-06-25",
    applicants: 1,
    status: "Active",
    hiringManager: "James Wilson",
  },
  {
    id: 5,
    position: "Billing Specialist",
    department: "EO",
    postedDate: "2026-07-01",
    applicants: 1,
    status: "New",
    hiringManager: "Maria Garcia",
  },
];

const kpiData = [
  { label: "Open Requisitions", value: "4", icon: Briefcase, color: "#245C5A" },
  { label: "Applicants This Month", value: "12", icon: UserPlus, color: "#7EC8CA" },
  { label: "Time to Fill (avg)", value: "18 days", icon: Clock, color: "#245C5A" },
  { label: "Offer Acceptance Rate", value: "75%", icon: CheckCircle, color: "#7EC8CA" },
];

const statusOptions = ["All", "Active", "Interviewing", "New", "Closed"];

const RecruitmentPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const filtered = demoRequisitions.filter((r) => {
    const matchesSearch =
      r.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.hiringManager.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Active: "bg-[#7EC8CA]/20 text-[#245C5A] border-[#7EC8CA]/40",
      Interviewing: "bg-amber-50 text-amber-700 border-amber-200",
      New: "bg-blue-50 text-blue-700 border-blue-200",
      Closed: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return styles[status] || styles.Active;
  };

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a38]">Recruitment Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track open requisitions, applicants, and hiring progress across all departments.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${kpi.color}15` }}
            >
              <kpi.icon size={24} style={{ color: kpi.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1a3a38]">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search positions, departments, managers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7EC8CA] focus:border-transparent w-full sm:w-72"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#7EC8CA]"
            >
              <Filter size={16} />
              {statusFilter === "All" ? "Status" : statusFilter}
              <ChevronDown size={14} />
            </button>
            {showStatusDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {statusOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setStatusFilter(opt);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      statusFilter === opt ? "bg-[#245C5A] text-white hover:bg-[#245C5A]" : "text-gray-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Download size={16} />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={16} />
            New Requisition
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#245C5A] text-white">
                <th className="text-left px-4 py-3 font-semibold">Position</th>
                <th className="text-left px-4 py-3 font-semibold">Department</th>
                <th className="text-left px-4 py-3 font-semibold">Posted Date</th>
                <th className="text-left px-4 py-3 font-semibold">Applicants</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Hiring Manager</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a3a38]">{row.position}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                      {row.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.postedDate}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <UserPlus size={14} className="text-[#245C5A]" />
                      {row.applicants}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.hiringManager}</td>
                  <td className="px-4 py-3">
                    <button className="text-[#245C5A] hover:text-[#1a3a38] text-xs font-medium underline">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No requisitions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing {filtered.length} of {demoRequisitions.length} requisitions</span>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RecruitmentPage;
