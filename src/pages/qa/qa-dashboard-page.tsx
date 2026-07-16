import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  Shield,
  ClipboardCheck,
  ChevronRight,
  FileWarning,
  Database,
  FileText,
  AlertOctagon,
} from "lucide-react";
import { QASentinelFilters } from "@/components/sentinel/qa-sentinel-filters";
import { SentinelControlBand } from "@/components/sentinel/sentinel-control-band";

const complianceAreas = [
  { label: "HIPAA Privacy", score: 98, status: "compliant" as const },
  { label: "HIPAA Security", score: 96, status: "compliant" as const },
  { label: "42 CFR Part 2", score: 100, status: "compliant" as const },
  { label: "State Licensure", score: 92, status: "warning" as const },
  { label: "Staff Credentials", score: 88, status: "warning" as const },
  { label: "Incident Reporting", score: 100, status: "compliant" as const },
  { label: "Medication Management", score: 95, status: "compliant" as const },
  { label: "Youth Rights", score: 97, status: "compliant" as const },
];

function ComplianceRow({
  label,
  score,
  status,
}: {
  label: string;
  score: number;
  status: "compliant" | "warning" | "violation";
}) {
  const fillColor =
    status === "compliant" ? "#22c55e" : status === "warning" ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] truncate" style={{ color: "var(--topbar-subtitle)" }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${score * 0.6}px`,
            backgroundColor: fillColor,
            minWidth: "20px",
          }}
        />
        <span className="text-[10px] font-mono w-6 text-right" style={{ color: fillColor }}>
          {score}
        </span>
      </div>
    </div>
  );
}

function Widget({ title, count, label, color, icon, link }: { title: string; count: number; label: string; color: string; icon: React.ReactNode; link: string }) {
  return (
    <Link to={link} className="rounded-xl border p-4 block transition-all hover:opacity-80" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            {icon}
          </div>
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>{title}</span>
        </div>
        <ChevronRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] font-bold" style={{ color }}>{count}</span>
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{label}</span>
      </div>
    </Link>
  );
}

export function QADashboardPage() {
  const [mode, setMode] = useState<"snapshot" | "trend">("snapshot");
  const [scope, setScope] = useState<"facility" | "organization" | "system">("organization");

  const { data: sentinel } = trpc.m3.sentinel.useQuery();
  const { data: complianceScore } = trpc.m3.complianceScore.useQuery();
  const { data: capStats } = trpc.m3.capStats.useQuery();
  const { data: auditStats } = trpc.m3.auditBinderStats.useQuery();
  const { data: evidenceStats } = trpc.m3.evidenceStats.useQuery();
  const { data: memoStats } = trpc.m3.memoStats.useQuery();
  const { data: defStats } = trpc.m3.deficiencyStats.useQuery();

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Shield size={22} style={{ color: "#7C3AED" }} /> Quality Assurance
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
            QA Sentinel / Audit / Compliance / Risk / Part-2
          </p>
        </div>
      </div>

      {/* Sentinel Controls */}
      <SentinelControlBand
        mode={mode}
        onModeChange={setMode}
        scope={scope}
        onScopeChange={setScope}
      />

      {/* Widgets Row — 5 QA Features */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Widget
          title="CAP Tracker"
          count={capStats?.open ?? 0}
          label={`${capStats?.overdue ?? 0} overdue`}
          color="#7C3AED"
          icon={<FileWarning size={16} style={{ color: "#7C3AED" }} />}
          link="/qa/cap-tracker"
        />
        <Widget
          title="Audit Binder"
          count={auditStats?.inProgress ?? 0}
          label={`${auditStats?.total ?? 0} total audits`}
          color="#D97706"
          icon={<ClipboardCheck size={16} style={{ color: "#D97706" }} />}
          link="/qa/audit-binder"
        />
        <Widget
          title="Evidence Matrix"
          count={evidenceStats?.active ?? 0}
          label={`${evidenceStats?.total ?? 0} total items`}
          color="#0891B2"
          icon={<Database size={16} style={{ color: "#0891B2" }} />}
          link="/qa/evidence-matrix"
        />
        <Widget
          title="Compliance Memos"
          count={memoStats?.draft ?? 0}
          label={`${memoStats?.issued ?? 0} issued`}
          color="#2563EB"
          icon={<FileText size={16} style={{ color: "#2563EB" }} />}
          link="/qa/memos"
        />
        <Widget
          title="Deficiencies"
          count={defStats?.open ?? 0}
          label={`${defStats?.overdue ?? 0} overdue`}
          color="#DC2626"
          icon={<AlertOctagon size={16} style={{ color: "#DC2626" }} />}
          link="/qa/deficiencies"
        />
      </div>

      {/* Filters */}
      <QASentinelFilters />

      {/* Grid: Sentinel + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sentinel Score */}
        <div className="rounded-xl border p-5 flex flex-col items-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <span className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--topbar-subtitle)" }}>
            Sentinel Score
          </span>
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="45" fill="none" stroke="rgba(76,175,80,0.12)" strokeWidth="10" />
            <circle
              cx="55"
              cy="55"
              r="45"
              fill="none"
              stroke={sentinel && sentinel.score >= 90 ? "#4CAF50" : "#F59E0B"}
              strokeWidth="10"
              strokeDasharray={`${(sentinel?.score ?? 91) * 2.83} 283`}
              strokeLinecap="round"
              transform="rotate(-90 55 55)"
            />
            <text x="55" y="55" textAnchor="middle" dominantBaseline="central" className="text-[28px] font-bold" fill="var(--topbar-title)">
              {sentinel?.score ?? 91}
            </text>
          </svg>
          <div className="flex gap-3 mt-3">
            {[
              { count: sentinel?.overdueCAPs ?? 0, label: "Overdue CAPs", color: "#F59E0B" },
              { count: sentinel?.openFindings ?? 0, label: "Open Findings", color: "#F59E0B" },
              { count: sentinel?.unresolvedRisks ?? 0, label: "Risk Items", color: "#EF4444" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <span className="text-[14px] font-semibold block" style={{ color: item.color }}>{item.count}</span>
                <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Bar */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              Compliance by Area
            </h3>
            <span className="text-[12px] font-bold" style={{ color: complianceScore && complianceScore >= 95 ? "#22c55e" : "#F59E0B" }}>
              {complianceScore ?? 94}%
            </span>
          </div>
          <div className="space-y-2.5">
            {complianceAreas.map((area) => (
              <ComplianceRow key={area.label} {...area} />
            ))}
          </div>
          {/* Regulatory Links */}
          <div className="mt-4 pt-3 flex gap-2" style={{ borderTop: "1px solid var(--card-border)" }}>
            <Link
              to="/qa/registry"
              className="text-[11px] px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)", backgroundColor: "var(--card-bg)" }}
            >
              QA Registry
            </Link>
            <Link
              to="/compliance/part2"
              className="text-[11px] px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)", backgroundColor: "var(--card-bg)" }}
            >
              42 CFR Part 2
            </Link>
            <Link
              to="/qa/audit-binder"
              className="text-[11px] px-3 py-1.5 rounded-md border transition-all hover:opacity-80"
              style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)", backgroundColor: "var(--card-bg)" }}
            >
              Audit Binder
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent CAPs Summary */}
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>CAP Summary</h3>
            <Link to="/qa/cap-tracker" className="text-[10px] hover:underline" style={{ color: "#245C5A" }}>View all</Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Open CAPs</span>
              <span className="font-semibold" style={{ color: "#D97706" }}>{capStats?.open ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Overdue</span>
              <span className="font-semibold" style={{ color: "#DC2626" }}>{capStats?.overdue ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Pending Verification</span>
              <span className="font-semibold" style={{ color: "#2563EB" }}>{capStats?.pendingVerification ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Completed (30d)</span>
              <span className="font-semibold" style={{ color: "#059669" }}>{capStats?.completed ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Deficiency Summary */}
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Deficiency Summary</h3>
            <Link to="/qa/deficiencies" className="text-[10px] hover:underline" style={{ color: "#245C5A" }}>View all</Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Open / POC Pending</span>
              <span className="font-semibold" style={{ color: "#DC2626" }}>{defStats?.open ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>In Progress</span>
              <span className="font-semibold" style={{ color: "#D97706" }}>{defStats?.inProgress ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Corrected</span>
              <span className="font-semibold" style={{ color: "#2563EB" }}>{defStats?.corrected ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--topbar-subtitle)" }}>Verified/Closed</span>
              <span className="font-semibold" style={{ color: "#059669" }}>{defStats?.verified ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QADashboardPage;
