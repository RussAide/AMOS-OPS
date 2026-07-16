import { useState } from "react";
import {
  Search,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  ToggleLeft,
  Edit3,
  History,
} from "lucide-react";

const workflowData = [
  {
    ruleName: "Welcome Email",
    trigger: "New Hire Record Created",
    condition: "Employee status = 'Active' AND hire date = today",
    action: "Send automated welcome email with login credentials",
    status: "Enabled",
    lastTriggered: "2025-04-18 09:14 AM",
  },
  {
    ruleName: "Manager Notification",
    trigger: "New Hire Record Created",
    condition: "Department is not empty",
    action: "Notify direct manager of new team member",
    status: "Enabled",
    lastTriggered: "2025-04-18 09:14 AM",
  },
  {
    ruleName: "IT Setup Request",
    trigger: "New Hire Record Created",
    condition: "Role requires system access",
    action: "Create IT ticket for laptop, email, VPN setup",
    status: "Enabled",
    lastTriggered: "2025-04-17 02:30 PM",
  },
  {
    ruleName: "Badge Photo",
    trigger: "First Day Check-In",
    condition: "Badge photo field is empty",
    action: "Schedule badge photo appointment with HR",
    status: "Enabled",
    lastTriggered: "2025-04-16 08:45 AM",
  },
  {
    ruleName: "Handbook Acknowledgment",
    trigger: "First Day Check-In",
    condition: "Acknowledgment status = 'Pending'",
    action: "Send employee handbook and require e-signature",
    status: "Enabled",
    lastTriggered: "2025-04-15 10:22 AM",
  },
  {
    ruleName: "Benefits Enrollment",
    trigger: "Day 3 of Employment",
    condition: "Benefits eligibility = 'Eligible'",
    action: "Open benefits enrollment window in HR portal",
    status: "Enabled",
    lastTriggered: "2025-04-14 11:00 AM",
  },
  {
    ruleName: "Training Schedule",
    trigger: "Day 5 of Employment",
    condition: "Training plan is assigned",
    action: "Generate personalized 90-day training calendar",
    status: "Disabled",
    lastTriggered: "2025-04-10 03:15 PM",
  },
  {
    ruleName: "Policy Review",
    trigger: "Day 7 of Employment",
    condition: "Policy review status = 'Not Started'",
    action: "Assign required policy review modules",
    status: "Enabled",
    lastTriggered: "2025-04-12 01:30 PM",
  },
  {
    ruleName: "30-Day Check-in",
    trigger: "30 Days After Hire",
    condition: "Check-in meeting status = 'Pending'",
    action: "Schedule 30-day check-in with HR and manager",
    status: "Enabled",
    lastTriggered: "2025-04-08 09:00 AM",
  },
];

const kpiData = [
  {
    label: "Active Rules",
    value: 9,
    icon: TrendingUp,
    color: "text-[#7EC8CA]",
    bg: "bg-[#7EC8CA]/10",
  },
  {
    label: "Triggered Today",
    value: 3,
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    label: "Pending Approvals",
    value: 2,
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    label: "Avg Processing",
    value: "4.2h",
    icon: Clock,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

export default function OnboardingWorkflowPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = workflowData.filter((row) => {
    const matchSearch =
      row.ruleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "All" || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "Enabled":
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
      case "Disabled":
        return "bg-gray-500/15 text-gray-400 border border-gray-500/20";
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
          Onboarding Workflow Engine
        </h1>
        <p className="text-gray-400 text-sm">
          Automate and manage new hire onboarding workflows. Configure trigger
          rules, set conditions, and track execution of onboarding tasks from
          day one through the first 30 days.
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
              placeholder="Search rule, trigger, or action..."
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
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: "#245C5A", borderColor: "rgba(126,200,202,0.2)" }}>
            <ToggleLeft size={16} />
            Enable / Disable
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <Edit3 size={16} />
            Edit Rule
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border hover:text-white transition-colors" style={{ backgroundColor: "#0a1515", borderColor: "rgba(126,200,202,0.2)" }}>
            <History size={16} />
            View History
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
                  "Rule Name",
                  "Trigger",
                  "Condition",
                  "Action",
                  "Status",
                  "Last Triggered",
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
                    {row.ruleName}
                  </td>
                  <td className="py-3.5 px-4 text-gray-300">{row.trigger}</td>
                  <td className="py-3.5 px-4 text-gray-400 text-xs max-w-xs truncate">
                    {row.condition}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400 text-xs max-w-xs truncate">
                    {row.action}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}
                    >
                      {row.status === "Enabled" ? (
                        <CheckCircle size={12} />
                      ) : (
                        <ToggleLeft size={12} />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-400 font-mono text-xs">
                    {row.lastTriggered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No workflow rules match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
