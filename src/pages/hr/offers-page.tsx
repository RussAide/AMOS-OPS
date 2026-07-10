import React, { useState } from "react";
import {
  Search,
  Filter,
  FileText,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronDown,
  DollarSign,
  Send,
  Eye,
} from "lucide-react";

interface Offer {
  id: number;
  candidate: string;
  position: string;
  offerDate: string;
  salary: string;
  status: string;
  startDate: string;
}

const demoOffers: Offer[] = [
  {
    id: 1,
    candidate: "Robert Singh",
    position: "RN Charge Nurse",
    offerDate: "2026-06-28",
    salary: "$78,000 / yr",
    status: "Pending",
    startDate: "2026-07-20",
  },
  {
    id: 2,
    candidate: "Laura Nguyen",
    position: "Case Manager",
    offerDate: "2026-06-25",
    salary: "$62,000 / yr",
    status: "Accepted",
    startDate: "2026-07-14",
  },
  {
    id: 3,
    candidate: "Daniel Rivera",
    position: "Youth Care Worker",
    offerDate: "2026-06-20",
    salary: "$48,000 / yr",
    status: "Accepted",
    startDate: "2026-07-10",
  },
  {
    id: 4,
    candidate: "Stephanie Kim",
    position: "Billing Specialist",
    offerDate: "2026-06-18",
    salary: "$55,000 / yr",
    status: "Declined",
    startDate: "—",
  },
  {
    id: 5,
    candidate: "Christopher Lee",
    position: "Case Manager",
    offerDate: "2026-06-29",
    salary: "$65,000 / yr",
    status: "Negotiating",
    startDate: "TBD",
  },
];

const kpiData = [
  { label: "Pending Offers", value: "2", icon: FileText, color: "#245C5A" },
  { label: "Accepted", value: "3", icon: CheckCircle, color: "#7EC8CA" },
  { label: "Declined", value: "1", icon: XCircle, color: "#245C5A" },
  { label: "Negotiating", value: "1", icon: MessageSquare, color: "#7EC8CA" },
];

const statusOptions = ["All", "Pending", "Accepted", "Declined", "Negotiating"];

const OffersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const filtered = demoOffers.filter((o) => {
    const matchesSearch =
      o.candidate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: "bg-amber-50 text-amber-700 border-amber-200",
      Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Declined: "bg-red-50 text-red-700 border-red-200",
      Negotiating: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a38]">Offer Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage salary offers, track candidate responses, and monitor negotiation status.
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
              placeholder="Search candidates or positions..."
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
            <Send size={16} />
            Extend Offer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#245C5A] text-white">
                <th className="text-left px-4 py-3 font-semibold">Candidate</th>
                <th className="text-left px-4 py-3 font-semibold">Position</th>
                <th className="text-left px-4 py-3 font-semibold">Offer Date</th>
                <th className="text-left px-4 py-3 font-semibold">Salary</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Start Date</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a3a38]">{row.candidate}</td>
                  <td className="px-4 py-3 text-gray-600">{row.position}</td>
                  <td className="px-4 py-3 text-gray-600">{row.offerDate}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-medium text-[#1a3a38]">
                      <DollarSign size={14} className="text-[#245C5A]" />
                      {row.salary}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.startDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
                        <Eye size={14} />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No offers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing {filtered.length} of {demoOffers.length} offers</span>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default OffersPage;
