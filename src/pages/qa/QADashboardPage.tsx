import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import {
  ShieldCheck, ClipboardCheck, AlertTriangle, FileWarning,
  CheckCircle, Clock, TrendingUp, Users
} from "lucide-react";

export function QADashboardPage() {
  const kpiCards = [
    { label: "Audit Score", value: "94%", icon: ShieldCheck, color: "#059669" },
    { label: "Open Audits", value: 3, icon: ClipboardCheck, color: "#D97706" },
    { label: "Incidents", value: 1, icon: AlertTriangle, color: "#DC2626" },
    { label: "Corrective Actions", value: 2, icon: FileWarning, color: "#7C3AED" },
    { label: "Compliant", value: 28, icon: CheckCircle, color: "#2563EB" },
    { label: "Overdue", value: 0, icon: Clock, color: "#DC2626" },
  ];

  const complianceAreas = [
    { name: "HIPAA Privacy", score: 98, status: "compliant" as const },
    { name: "HIPAA Security", score: 96, status: "compliant" as const },
    { name: "42 CFR Part 2", score: 100, status: "compliant" as const },
    { name: "State Licensure", score: 92, status: "warning" as const },
    { name: "Staff Credentials", score: 88, status: "warning" as const },
    { name: "Incident Reporting", score: 100, status: "compliant" as const },
  ];

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>QA & Compliance</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Quality Assurance, Audits & Regulatory Compliance</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {kpiCards.map((c) => (
            <div key={c.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
              <p className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Compliance Area Scores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {complianceAreas.map((area) => (
              <div key={area.name} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{area.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      backgroundColor: area.status === "compliant" ? "#D1FAE5" : area.status === "warning" ? "#FEF3C7" : "#FEE2E2",
                      color: area.status === "compliant" ? "#059669" : area.status === "warning" ? "#D97706" : "#DC2626",
                    }}
                  >
                    {area.status}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${area.score}%`,
                      backgroundColor: area.score >= 95 ? "#059669" : area.score >= 85 ? "#D97706" : "#DC2626",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{area.score}%</span>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Target: 95%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
