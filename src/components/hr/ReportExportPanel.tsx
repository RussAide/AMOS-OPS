import { useState } from "react";
import { FileText, Download, AlertTriangle, Users, History } from "lucide-react";
import { useHR } from "@/context/HRContext";
import { getMissingDocumentsGlobally } from "@/data/hrDocumentData";
import { ALL_HR_MODULES } from "@/data/hrLifecycleData";

interface ReportType {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  color: string;
  bgColor: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "workforce",
    label: "Workforce Status Matrix",
    description: "Full status of all personnel across 11 HR modules",
    icon: Users,
    color: "#245C5A",
    bgColor: "#F0FDFA",
  },
  {
    id: "missing-docs",
    label: "Missing Documents Report",
    description: "All missing required records by person and module",
    icon: AlertTriangle,
    color: "#DC2626",
    bgColor: "#FEF2F2",
  },
  {
    id: "audit-trail",
    label: "Status Change Audit Trail",
    description: "Complete log of all status transitions with timestamps",
    icon: History,
    color: "#2563EB",
    bgColor: "#EFF6FF",
  },
];

export function ReportExportPanel() {
  const { people, transitions, documents } = useHR();
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const missingDocs = getMissingDocumentsGlobally(
    documents,
    people.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, moduleStatuses: p.moduleStatuses })),
    ALL_HR_MODULES.map((m) => ({ id: m.id, name: m.name, requiredRecords: m.requiredRecords }))
  );

  const handleExport = (reportId: string) => {
    setGenerating(reportId);
    // Generate a simple CSV/printable report
    setTimeout(() => {
      const report = generateReport(reportId, { people, transitions, missingDocs });
      downloadReport(report, reportId);
      setGenerating(null);
    }, 800);
  };

  return (
    <div className="rounded-lg border mb-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
            <FileText size={16} style={{ color: "#245C5A" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              Reports &amp; Exports
            </p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Generate compliance and audit reports
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
          {REPORT_TYPES.length} reports
        </span>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: "var(--card-border)" }}>
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon;
            const isGenerating = generating === rt.id;
            return (
              <div
                key={rt.id}
                className="flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm"
                style={{ borderColor: "#E2E8F0", backgroundColor: rt.bgColor }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} style={{ color: rt.color }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: rt.color }}>
                      {rt.label}
                    </p>
                    <p className="text-[11px]" style={{ color: "#6B7280" }}>
                      {rt.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport(rt.id)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: rt.color,
                    color: "#fff",
                    cursor: isGenerating ? "wait" : "pointer",
                  }}
                >
                  <Download size={12} />
                  {isGenerating ? "Generating..." : "Export CSV"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Report Generators ────────────────────────────────────────

function generateReport(
  reportId: string,
  data: { people: HRPerson[]; transitions: StatusTransition[]; missingDocs: ReturnType<typeof getMissingDocumentsGlobally> }
): string {
  const { people, transitions, missingDocs } = data;

  if (reportId === "workforce") {
    const headers = ["Person", "Role", "Department", "Type", ...ALL_HR_MODULES.map((m) => m.name)];
    const rows = people.map((p) => [
      `${p.firstName} ${p.lastName}`,
      p.role,
      p.department,
      p.isEmployee ? "Employee" : "Candidate",
      ...ALL_HR_MODULES.map((m) => {
        const status = p.moduleStatuses[m.id];
        if (!status) return "—";
        const statusDef = m.statusModel.find((s) => s.id === status);
        return statusDef?.label || status;
      }),
    ]);
    return toCSV(headers, rows);
  }

  if (reportId === "missing-docs") {
    const headers = ["Person", "Module", "Missing Records"];
    const rows = missingDocs.map((md) => [
      md.personName,
      md.moduleName,
      md.missingRecords.join("; "),
    ]);
    return toCSV(headers, rows);
  }

  if (reportId === "audit-trail") {
    const headers = ["Date", "Person", "Module", "From Status", "To Status", "Changed By", "Note"];
    const sorted = [...transitions].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    const rows = sorted.map((t) => [
      new Date(t.changedAt).toLocaleString("en-US"),
      t.personName,
      t.moduleName,
      t.fromStatus,
      t.toStatus,
      t.changedBy,
      t.note || "",
    ]);
    return toCSV(headers, rows);
  }

  return "";
}

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const rowLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...rowLines].join("\n");
}

function downloadReport(content: string, reportId: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const date = new Date().toISOString().split("T")[0];
  const names: Record<string, string> = {
    workforce: `AMOS-Workforce-Status-${date}.csv`,
    "missing-docs": `AMOS-Missing-Documents-${date}.csv`,
    "audit-trail": `AMOS-Audit-Trail-${date}.csv`,
  };
  link.download = names[reportId] || `AMOS-Report-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import type { HRPerson } from "@/data/hrLifecycleData";
import type { StatusTransition } from "@/context/HRContext";
