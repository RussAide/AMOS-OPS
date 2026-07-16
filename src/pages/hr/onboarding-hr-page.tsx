import React, { useState } from "react";
import {
  Search,
  Filter,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  Eye,
  Bell,
  TrendingUp,
} from "lucide-react";

interface OnboardingRecord {
  id: number;
  newHire: string;
  position: string;
  startDate: string;
  day1to7: number;
  week2: number;
  week3: number;
  week4: number;
  status: string;
}

const demoOnboarding: OnboardingRecord[] = [
  {
    id: 1,
    newHire: "Robert Singh",
    position: "RN Charge Nurse",
    startDate: "2026-07-20",
    day1to7: 100,
    week2: 100,
    week3: 75,
    week4: 30,
    status: "In Progress",
  },
  {
    id: 2,
    newHire: "Laura Nguyen",
    position: "Case Manager",
    startDate: "2026-07-14",
    day1to7: 100,
    week2: 100,
    week3: 100,
    week4: 100,
    status: "Completed",
  },
  {
    id: 3,
    newHire: "Daniel Rivera",
    position: "Youth Care Worker",
    startDate: "2026-07-10",
    day1to7: 100,
    week2: 100,
    week3: 100,
    week4: 100,
    status: "Completed",
  },
  {
    id: 4,
    newHire: "Michelle Adams",
    position: "Youth Care Worker",
    startDate: "2026-06-28",
    day1to7: 100,
    week2: 100,
    week3: 50,
    week4: 0,
    status: "Overdue",
  },
  {
    id: 5,
    newHire: "Christopher Lee",
    position: "Case Manager",
    startDate: "2026-07-28",
    day1to7: 85,
    week2: 40,
    week3: 0,
    week4: 0,
    status: "In Progress",
  },
];

const kpiData = [
  { label: "In Progress", value: "4", icon: RotateCcw, color: "#245C5A" },
  { label: "Completed", value: "12", icon: CheckCircle, color: "#7EC8CA" },
  { label: "Overdue", value: "1", icon: AlertTriangle, color: "#245C5A" },
  { label: "Avg Days", value: "14", icon: Clock, color: "#7EC8CA" },
];

const statusOptions = ["All", "In Progress", "Completed", "Overdue"];

const OnboardingHRPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const filtered = demoOnboarding.filter((o) => {
    const matchesSearch =
      o.newHire.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
      Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Overdue: "bg-red-50 text-red-700 border-red-200",
    };
    return styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  const getMiniBarColor = (value: number) => {
    if (value === 100) return "bg-emerald-500";
    if (value >= 50) return "bg-[#7EC8CA]";
    if (value > 0) return "bg-[#245C5A]";
    return "bg-gray-200";
  };

  const MiniProgressBar: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
        <span className="text-[10px] text-gray-600 font-semibold">{value}%</span>
      </div>
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${getMiniBarColor(value)}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a38]">Onboarding Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor new hire onboarding progress across Day 1-7, Week 2, Week 3, and Week 4 milestones.
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
              placeholder="Search new hires or positions..."
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
            <TrendingUp size={16} />
            View Progress
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
                <th className="text-left px-4 py-3 font-semibold">Start Date</th>
                <th className="text-center px-4 py-3 font-semibold">Day 1-7</th>
                <th className="text-center px-4 py-3 font-semibold">Week 2</th>
                <th className="text-center px-4 py-3 font-semibold">Week 3</th>
                <th className="text-center px-4 py-3 font-semibold">Week 4</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a3a38]">{row.newHire}</td>
                  <td className="px-4 py-3 text-gray-600">{row.position}</td>
                  <td className="px-4 py-3 text-gray-600">{row.startDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <MiniProgressBar value={row.day1to7} label="D1-7" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <MiniProgressBar value={row.week2} label="W2" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <MiniProgressBar value={row.week3} label="W3" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <MiniProgressBar value={row.week4} label="W4" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
                        <Eye size={14} />
                        View
                      </button>
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <Bell size={14} />
                        Remind
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No onboarding records found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing {filtered.length} of {demoOnboarding.length} onboarding records</span>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default OnboardingHRPage;
