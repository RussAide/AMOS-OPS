import { useState } from "react";
import {
  Search,
  Target,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Plus,
  Eye,
  Send,
} from "lucide-react";

const reviewData = [
  {
    employee: "Synthetic Staff 01",
    position: "Lead RN",
    reviewPeriod: "Jan 2025 – Jun 2025",
    selfReview: "Submitted",
    supervisorReview: "Completed",
    finalRating: "Exceeds Expectations",
    status: "Completed",
  },
  {
    employee: "Michael Chen",
    position: "Clinical Therapist",
    reviewPeriod: "Jan 2025 – Jun 2025",
    selfReview: "Submitted",
    supervisorReview: "Pending",
    finalRating: "—",
    status: "Supervisor Review",
  },
  {
    employee: "Synthetic Staff 04",
    position: "QMHP",
    reviewPeriod: "Jan 2025 – Jun 2025",
    selfReview: "Pending",
    supervisorReview: "Pending",
    finalRating: "—",
    status: "Self-Review Pending",
  },
  {
    employee: "Synthetic-Person-037 Roberts",
    position: "CPI Specialist",
    reviewPeriod: "Jul 2024 – Dec 2024",
    selfReview: "Submitted",
    supervisorReview: "Completed",
    finalRating: "Meets Expectations",
    status: "Completed",
  },
  {
    employee: "Synthetic Staff 09",
    position: "Case Manager",
    reviewPeriod: "Jan 2025 – Jun 2025",
    selfReview: "Pending",
    supervisorReview: "Pending",
    finalRating: "—",
    status: "Overdue",
  },
  {
    employee: "Lisa Thompson",
    position: "Intake Coordinator",
    reviewPeriod: "Jul 2024 – Dec 2024",
    selfReview: "Submitted",
    supervisorReview: "Completed",
    finalRating: "Needs Improvement",
    status: "Completed",
  },
];

const kpiData = [
  {
    label: "Due",
    value: 5,
    icon: Target,
    color: "text-[#7EC8CA]",
    bg: "bg-[#7EC8CA]/10",
  },
  {
    label: "Completed",
    value: 18,
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    label: "Overdue",
    value: 2,
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    label: "Self-Review Pending",
    value: 3,
    icon: UserCheck,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
];

export default function PerformanceReviewsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = reviewData.filter((row) => {
    const matchSearch =
      row.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "All" || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
      case "Supervisor Review":
        return "bg-blue-500/15 text-blue-400 border border-blue-500/20";
      case "Self-Review Pending":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
      case "Overdue":
        return "bg-red-500/15 text-red-400 border border-red-500/20";
      default:
        return "bg-gray-500/15 text-gray-400 border border-gray-500/20";
    }
  };

  const ratingBadge = (rating: string) => {
    switch (rating) {
      case "Exceeds Expectations":
        return "text-emerald-400 font-semibold";
      case "Meets Expectations":
        return "text-blue-400 font-semibold";
      case "Needs Improvement":
        return "text-amber-400 font-semibold";
      default:
        return "text-gray-500";
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
          Performance Reviews
        </h1>
        <p className="text-gray-400 text-sm">
          Manage employee performance review cycles, track self-reviews and
          supervisor evaluations, and monitor final ratings across all clinical
          and administrative staff.
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
              placeholder="Search employee or position..."
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
            <option value="Completed">Completed</option>
            <option value="Supervisor Review">Supervisor Review</option>
            <option value="Self-Review Pending">Self-Review Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: "#245C5A", borderColor: "rgba(126,200,202,0.2)" }}>
            <Plus size={16} />
            Initiate Review
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <Eye size={16} />
            View Review
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <Send size={16} />
            Submit
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
                  "Position",
                  "Review Period",
                  "Self-Review",
                  "Supervisor Review",
                  "Final Rating",
                  "Status",
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
                  <td className="py-3.5 px-4 text-gray-300">
                    {row.position}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {row.reviewPeriod}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        row.selfReview === "Submitted"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {row.selfReview === "Submitted" ? (
                        <CheckCircle size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {row.selfReview}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        row.supervisorReview === "Completed"
                          ? "text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {row.supervisorReview === "Completed" ? (
                        <CheckCircle size={12} />
                      ) : (
                        <Target size={12} />
                      )}
                      {row.supervisorReview}
                    </span>
                  </td>
                  <td className={`py-3.5 px-4 ${ratingBadge(row.finalRating)}`}>
                    {row.finalRating}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}
                    >
                      {row.status === "Completed" && (
                        <CheckCircle size={12} />
                      )}
                      {row.status === "Overdue" && (
                        <AlertTriangle size={12} />
                      )}
                      {row.status === "Self-Review Pending" && (
                        <UserCheck size={12} />
                      )}
                      {row.status === "Supervisor Review" && (
                        <Target size={12} />
                      )}
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No performance reviews match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
