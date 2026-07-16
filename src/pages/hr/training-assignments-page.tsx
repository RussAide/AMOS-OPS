import { useState } from "react";
import {
  Search,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Clock,
  Plus,
  Send,
  PenLine,
} from "lucide-react";

const trainingData = [
  {
    employee: "Synthetic Staff 01",
    module: "HIPAA Compliance",
    assignedDate: "2025-04-01",
    dueDate: "2025-04-15",
    completionDate: "2025-04-10",
    status: "Completed",
    score: 95,
  },
  {
    employee: "Michael Chen",
    module: "CPI Training",
    assignedDate: "2025-04-02",
    dueDate: "2025-04-16",
    completionDate: "",
    status: "Overdue",
    score: null,
  },
  {
    employee: "Synthetic Staff 04",
    module: "De-escalation Techniques",
    assignedDate: "2025-04-05",
    dueDate: "2025-04-19",
    completionDate: "",
    status: "In Progress",
    score: null,
  },
  {
    employee: "Synthetic-Person-037 Roberts",
    module: "Medication Administration",
    assignedDate: "2025-04-03",
    dueDate: "2025-04-17",
    completionDate: "2025-04-12",
    status: "Completed",
    score: 88,
  },
  {
    employee: "Synthetic Staff 09",
    module: "Cultural Competency",
    assignedDate: "2025-04-08",
    dueDate: "2025-04-22",
    completionDate: "",
    status: "Assigned",
    score: null,
  },
  {
    employee: "Lisa Thompson",
    module: "Trauma-Informed Care",
    assignedDate: "2025-04-01",
    dueDate: "2025-04-15",
    completionDate: "2025-04-14",
    status: "Completed",
    score: 92,
  },
  {
    employee: "Synthetic-Person-001 Lee",
    module: "Suicide Prevention",
    assignedDate: "2025-04-06",
    dueDate: "2025-04-20",
    completionDate: "",
    status: "Overdue",
    score: null,
  },
  {
    employee: "Aisha Patel",
    module: "Documentation Standards",
    assignedDate: "2025-04-10",
    dueDate: "2025-04-24",
    completionDate: "",
    status: "Assigned",
    score: null,
  },
];

const kpiData = [
  {
    label: "Assigned",
    value: 18,
    icon: BookOpen,
    color: "text-[#7EC8CA]",
    bg: "bg-[#7EC8CA]/10",
  },
  {
    label: "Completed",
    value: 12,
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    label: "Overdue",
    value: 3,
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    label: "Upcoming",
    value: 5,
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
];

export default function TrainingAssignmentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = trainingData.filter((row) => {
    const matchSearch =
      row.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.module.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "All" || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
      case "In Progress":
        return "bg-blue-500/15 text-blue-400 border border-blue-500/20";
      case "Assigned":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
      case "Overdue":
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
          Training Assignments
        </h1>
        <p className="text-gray-400 text-sm">
          Assign, track, and manage employee training modules. Monitor
          completion rates, due dates, and certification scores across all
          clinical and compliance training programs.
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
              placeholder="Search employee or training module..."
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
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: "#245C5A", borderColor: "rgba(126,200,202,0.2)" }}>
            <Plus size={16} />
            Assign Training
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <Send size={16} />
            Send Reminder
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <PenLine size={16} />
            Mark Complete
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
                  "Training Module",
                  "Assigned Date",
                  "Due Date",
                  "Completion Date",
                  "Status",
                  "Score",
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
                  <td className="py-3.5 px-4 text-gray-300">{row.module}</td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {row.assignedDate}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">{row.dueDate}</td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {row.completionDate || "—"}
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
                      {row.status === "In Progress" && (
                        <Clock size={12} />
                      )}
                      {row.status === "Assigned" && (
                        <BookOpen size={12} />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {row.score !== null ? (
                      <span
                        className={`font-bold text-sm ${
                          row.score >= 90
                            ? "text-emerald-400"
                            : row.score >= 80
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {row.score}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No training assignments match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
