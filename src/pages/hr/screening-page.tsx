import React, { useState } from "react";
import {
  Search,
  Filter,
  ClipboardCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Phone,
} from "lucide-react";

interface Applicant {
  id: number;
  name: string;
  position: string;
  appliedDate: string;
  screenStatus: string;
  backgroundCheck: string;
  references: string;
}

const demoApplicants: Applicant[] = [
  {
    id: 1,
    name: "Michael Torres",
    position: "Youth Care Worker",
    appliedDate: "2026-06-18",
    screenStatus: "Pending Review",
    backgroundCheck: "Not Started",
    references: "Pending",
  },
  {
    id: 2,
    name: "Jennifer Walsh",
    position: "Case Manager",
    appliedDate: "2026-06-22",
    screenStatus: "Under Review",
    backgroundCheck: "In Progress",
    references: "Pending",
  },
  {
    id: 3,
    name: "Robert Singh",
    position: "RN Charge Nurse",
    appliedDate: "2026-06-12",
    screenStatus: "Cleared",
    backgroundCheck: "Cleared",
    references: "Verified",
  },
  {
    id: 4,
    name: "Amanda Brooks",
    position: "Youth Care Worker",
    appliedDate: "2026-06-28",
    screenStatus: "Pending Review",
    backgroundCheck: "Not Started",
    references: "Pending",
  },
  {
    id: 5,
    name: "Kevin Park",
    position: "Facilities Technician",
    appliedDate: "2026-06-26",
    screenStatus: "Flagged",
    backgroundCheck: "Alert",
    references: "Pending",
  },
  {
    id: 6,
    name: "Laura Nguyen",
    position: "Case Manager",
    appliedDate: "2026-06-19",
    screenStatus: "Cleared",
    backgroundCheck: "Cleared",
    references: "Verified",
  },
];

const kpiData = [
  { label: "Pending Review", value: "6", icon: Clock, color: "#245C5A" },
  { label: "Background Check", value: "3", icon: ShieldCheck, color: "#7EC8CA" },
  { label: "Reference Check", value: "2", icon: Phone, color: "#245C5A" },
  { label: "Cleared", value: "4", icon: CheckCircle, color: "#7EC8CA" },
];

const statusOptions = ["All", "Pending Review", "Under Review", "Cleared", "Flagged"];

const ScreeningPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const filtered = demoApplicants.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || a.screenStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getScreenBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Pending Review": "bg-amber-50 text-amber-700 border-amber-200",
      "Under Review": "bg-blue-50 text-blue-700 border-blue-200",
      Cleared: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Flagged: "bg-red-50 text-red-700 border-red-200",
    };
    return styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  const getBgCheckBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Not Started": "bg-gray-100 text-gray-500 border-gray-200",
      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
      Cleared: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Alert: "bg-red-50 text-red-700 border-red-200",
    };
    return styles[status] || styles["Not Started"];
  };

  const getReferenceBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: "bg-gray-100 text-gray-500 border-gray-200",
      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
      Verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return styles[status] || styles.Pending;
  };

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a38]">Applicant Screening</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and screen applicants through background checks, reference verification, and eligibility review.
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
              placeholder="Search applicants or positions..."
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
              {statusFilter === "All" ? "Screen Status" : statusFilter}
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
            <ClipboardCheck size={16} />
            Run Batch Screen
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#245C5A] text-white">
                <th className="text-left px-4 py-3 font-semibold">Applicant</th>
                <th className="text-left px-4 py-3 font-semibold">Position</th>
                <th className="text-left px-4 py-3 font-semibold">Applied Date</th>
                <th className="text-left px-4 py-3 font-semibold">Screen Status</th>
                <th className="text-left px-4 py-3 font-semibold">Background Check</th>
                <th className="text-left px-4 py-3 font-semibold">References</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a3a38]">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row.position}</td>
                  <td className="px-4 py-3 text-gray-600">{row.appliedDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getScreenBadge(row.screenStatus)}`}>
                      {row.screenStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getBgCheckBadge(row.backgroundCheck)}`}>
                      {row.backgroundCheck === "Alert" && <AlertTriangle size={10} className="inline mr-1" />}
                      {row.backgroundCheck}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getReferenceBadge(row.references)}`}>
                      {row.references}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
                      <UserCheck size={14} />
                      Screen
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No applicants found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing {filtered.length} of {demoApplicants.length} applicants</span>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default ScreeningPage;
