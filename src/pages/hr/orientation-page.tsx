import React, { useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Plus,
  ClipboardList,
  UserCheck,
  GraduationCap,
} from "lucide-react";

interface Orientation {
  id: number;
  newHire: string;
  position: string;
  orientationDate: string;
  status: string;
  completion: number;
  assignedTrainer: string;
}

const demoOrientations: Orientation[] = [
  {
    id: 1,
    newHire: "Robert Singh",
    position: "RN Charge Nurse",
    orientationDate: "2026-07-21",
    status: "Scheduled",
    completion: 0,
    assignedTrainer: "Lisa Thompson",
  },
  {
    id: 2,
    newHire: "Laura Nguyen",
    position: "Case Manager",
    orientationDate: "2026-07-15",
    status: "Scheduled",
    completion: 0,
    assignedTrainer: "David Chen",
  },
  {
    id: 3,
    newHire: "Daniel Rivera",
    position: "Youth Care Worker",
    orientationDate: "2026-07-11",
    status: "Completed",
    completion: 100,
    assignedTrainer: "Sarah Martinez",
  },
  {
    id: 4,
    newHire: "Michelle Adams",
    position: "Youth Care Worker",
    orientationDate: "2026-06-30",
    status: "Completed",
    completion: 100,
    assignedTrainer: "Sarah Martinez",
  },
  {
    id: 5,
    newHire: "James Cooper",
    position: "Facilities Technician",
    orientationDate: "2026-06-28",
    status: "No-Show",
    completion: 15,
    assignedTrainer: "James Wilson",
  },
];

const kpiData = [
  { label: "Scheduled", value: "3", icon: Calendar, color: "#245C5A" },
  { label: "Completed", value: "8", icon: CheckCircle, color: "#7EC8CA" },
  { label: "No-Show", value: "1", icon: XCircle, color: "#245C5A" },
  { label: "Avg Duration", value: "6 hrs", icon: Clock, color: "#7EC8CA" },
];

const statusOptions = ["All", "Scheduled", "Completed", "No-Show", "In Progress"];

const OrientationPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const filtered = demoOrientations.filter((o) => {
    const matchesSearch =
      o.newHire.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.assignedTrainer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Scheduled: "bg-blue-50 text-blue-700 border-blue-200",
      Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      "No-Show": "bg-red-50 text-red-700 border-red-200",
      "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
    };
    return styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  const getCompletionBarColor = (completion: number, status: string) => {
    if (status === "No-Show") return "bg-red-400";
    if (completion === 100) return "bg-emerald-500";
    if (completion >= 50) return "bg-[#7EC8CA]";
    return "bg-[#245C5A]";
  };

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a38]">Orientation Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Schedule and track new hire orientation sessions, trainers, and completion status.
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
              placeholder="Search new hires, positions, trainers..."
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
              <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={16} />
            Schedule Orientation
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#245C5A] text-white">
                <th className="text-left px-4 py-3 font-semibold">New Hire</th>
                <th className="text-left px-4 py-3 font-semibold">Position</th>
                <th className="text-left px-4 py-3 font-semibold">Orientation Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Completion %</th>
                <th className="text-left px-4 py-3 font-semibold">Assigned Trainer</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a3a38]">{row.newHire}</td>
                  <td className="px-4 py-3 text-gray-600">{row.position}</td>
                  <td className="px-4 py-3 text-gray-600">{row.orientationDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getCompletionBarColor(row.completion, row.status)}`}
                          style={{ width: `${row.completion}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8">{row.completion}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <GraduationCap size={14} className="text-[#245C5A]" />
                      {row.assignedTrainer}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
                        <ClipboardList size={14} />
                        Checklist
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No orientation records found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing {filtered.length} of {demoOrientations.length} orientations</span>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default OrientationPage;
