import React, { useState } from "react";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  UserCheck,
  ChevronDown,
  Send,
  Eye,
  GraduationCap,
  ClipboardList,
  XCircle,
  BarChart3,
} from "lucide-react";

interface TrainingRecord {
  id: number;
  employee: string;
  position: string;
  overdueModule: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
}

interface AuditFinding {
  id: number;
  area: string;
  description: string;
  severity: string;
  assignedTo: string;
  dueDate: string;
  status: string;
}

interface PolicyAck {
  id: number;
  policy: string;
  department: string;
  acknowledged: number;
  total: number;
  rate: number;
}

const trainingData: TrainingRecord[] = [
  {
    id: 1,
    employee: "Amanda Foster",
    position: "Case Manager",
    overdueModule: "Youth Safety Protocol",
    dueDate: "2025-06-01",
    daysOverdue: 15,
    status: "Overdue",
  },
  {
    id: 2,
    employee: "Marcus Johnson",
    position: "Youth Support Specialist",
    overdueModule: "HIPAA Compliance Refresher",
    dueDate: "2025-05-20",
    daysOverdue: 26,
    status: "Overdue",
  },
  {
    id: 3,
    employee: "Rachel Adams",
    position: "Mental Health Counselor",
    overdueModule: "Crisis Intervention Update",
    dueDate: "2025-06-10",
    daysOverdue: 6,
    status: "Overdue",
  },
  {
    id: 4,
    employee: "David Kim",
    position: "Behavioral Therapist",
    overdueModule: "Behavioral Red Flags",
    dueDate: "2025-06-12",
    daysOverdue: 4,
    status: "Due Soon",
  },
  {
    id: 5,
    employee: "Nicole Perez",
    position: "Registered Nurse",
    overdueModule: "Medication Administration",
    dueDate: "2025-05-15",
    daysOverdue: 31,
    status: "Overdue",
  },
];

const auditFindings: AuditFinding[] = [
  {
    id: 1,
    area: "Documentation & Records",
    description:
      "Incident report forms missing supervisor signature on 3 of 12 reviewed cases",
    severity: "Medium",
    assignedTo: "Sarah Mitchell",
    dueDate: "2025-07-15",
    status: "Open",
  },
  {
    id: 2,
    area: "Staff Training",
    description:
      "Two new hires have not completed mandatory Youth Safety orientation within 30-day window",
    severity: "High",
    assignedTo: "HR Department",
    dueDate: "2025-06-30",
    status: "Open",
  },
];

const policyAckData: PolicyAck[] = [
  {
    id: 1,
    policy: "Youth Safety & Protection Policy",
    department: "All Clinical",
    acknowledged: 18,
    total: 18,
    rate: 100,
  },
  {
    id: 2,
    policy: "HIPAA Privacy & Security",
    department: "All Staff",
    acknowledged: 23,
    total: 24,
    rate: 96,
  },
  {
    id: 3,
    policy: "Code of Conduct & Ethics",
    department: "All Staff",
    acknowledged: 22,
    total: 24,
    rate: 92,
  },
  {
    id: 4,
    policy: "Emergency Response Procedures",
    department: "Facility Staff",
    acknowledged: 20,
    total: 22,
    rate: 91,
  },
];

const kpiCards = [
  {
    label: "Overall Score",
    value: "88%",
    icon: BarChart3,
    color: "text-[#245C5A]",
    bg: "bg-[#245C5A]/10",
  },
  {
    label: "Open Findings",
    value: "2",
    icon: ClipboardList,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    label: "Overdue Training",
    value: "3",
    icon: GraduationCap,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    label: "Policy Acknowledgments",
    value: "94%",
    icon: FileText,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

const getTrainingStatusBadge = (status: string) => {
  switch (status) {
    case "Overdue":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <XCircle size={12} />
          Overdue
        </span>
      );
    case "Due Soon":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Clock size={12} />
          Due Soon
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

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case "High":
      return (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          High
        </span>
      );
    case "Medium":
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Medium
        </span>
      );
    case "Low":
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          Low
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {severity}
        </span>
      );
  }
};

const getAuditStatusBadge = (status: string) => {
  switch (status) {
    case "Open":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} />
          Open
        </span>
      );
    case "Resolved":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Resolved
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

const CircularScore = ({ score }: { score: number }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#245C5A"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#245C5A]">{score}%</span>
          <span className="text-[10px] text-gray-400">Overall</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <CheckCircle size={12} className="text-emerald-500" />
        Compliant
      </div>
    </div>
  );
};

export default function HrCompliancePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [trainingFilter, setTrainingFilter] = useState("All");

  const filteredTraining = trainingData.filter((record) => {
    const matchesSearch =
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.overdueModule.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      trainingFilter === "All" || record.status === trainingFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#245C5A]">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              HR Compliance & Audits
            </h1>
            <p className="text-sm text-gray-500">
              Track compliance scores, training completion, policy
              acknowledgments, and audit findings
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

      {/* Two Column Layout */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compliance Score Gauge */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Compliance Score
          </h3>
          <div className="flex justify-center">
            <CircularScore score={88} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Training Compliance</span>
              <span className="font-medium text-gray-900">92%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-[92%] rounded-full bg-[#245C5A]" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Policy Acknowledgments</span>
              <span className="font-medium text-gray-900">94%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-[94%] rounded-full bg-[#7EC8CA]" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Audit Findings</span>
              <span className="font-medium text-gray-900">78%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-[78%] rounded-full bg-amber-400" />
            </div>
          </div>
        </div>

        {/* Policy Acknowledgments */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Policy Acknowledgment Status
          </h3>
          <div className="space-y-3">
            {policyAckData.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {policy.policy}
                  </p>
                  <p className="text-xs text-gray-500">
                    {policy.department} — {policy.acknowledged} of {policy.total}{" "}
                    acknowledged
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        policy.rate >= 95
                          ? "bg-emerald-500"
                          : policy.rate >= 90
                            ? "bg-[#245C5A]"
                            : "bg-amber-400"
                      }`}
                      style={{ width: `${policy.rate}%` }}
                    />
                  </div>
                  <span
                    className={`w-10 text-right text-xs font-semibold ${
                      policy.rate >= 95
                        ? "text-emerald-600"
                        : policy.rate >= 90
                          ? "text-[#245C5A]"
                          : "text-amber-600"
                    }`}
                  >
                    {policy.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <CheckCircle size={12} className="text-emerald-500" />
              <span>On Track: 2</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-500" />
              <span>Attention: 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Training Compliance Table */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-[#245C5A]" />
            <h3 className="text-sm font-semibold text-gray-900">
              Training Compliance
            </h3>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              {trainingData.length} overdue
            </span>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <GraduationCap size={13} />
              Assign Training
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#245C5A] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#1a3a38]">
              <Send size={13} />
              Send Reminder
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Overdue Module</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Days Overdue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTraining.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {record.employee}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {record.position}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {record.overdueModule}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {record.dueDate}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        record.daysOverdue > 20
                          ? "text-red-600"
                          : record.daysOverdue > 10
                            ? "text-amber-600"
                            : "text-orange-500"
                      }`}
                    >
                      {record.daysOverdue} days
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {getTrainingStatusBadge(record.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#245C5A]">
                      <Send size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Findings Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[#245C5A]" />
            <h3 className="text-sm font-semibold text-gray-900">
              Audit Findings
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              {auditFindings.length} open
            </span>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <Eye size={13} />
              View Audit
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditFindings.map((finding) => (
                <tr key={finding.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {finding.area}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-600">
                    {finding.description}
                  </td>
                  <td className="px-4 py-3">
                    {getSeverityBadge(finding.severity)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {finding.assignedTo}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {finding.dueDate}
                  </td>
                  <td className="px-4 py-3">
                    {getAuditStatusBadge(finding.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
