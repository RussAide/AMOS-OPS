import { trpc } from "@/providers/trpc";
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Target,
  AlertTriangle, CheckCircle, XCircle, HelpCircle, ChevronRight,
  Building2, DollarSign, Users, Shield, HeartPulse, Database, Lightbulb,
} from "lucide-react";

const DOMAIN_ICONS = [Building2, DollarSign, Users, Shield, HeartPulse, Database, Lightbulb];
const DOMAIN_COLORS = [
  "#245C5A", "#D97706", "#4F46E5", "#991B1B", "#C45C4A", "#0891B2", "#7C3AED",
];

const STATUS_CONFIG = {
  on_target: { icon: CheckCircle, color: "#059669", bg: "#ECFDF5", label: "On Target" },
  at_risk: { icon: AlertTriangle, color: "#B45309", bg: "#FFFBEB", label: "At Risk" },
  off_target: { icon: XCircle, color: "#DC2626", bg: "#FEF2F2", label: "Off Target" },
  not_measured: { icon: HelpCircle, color: "#6B7280", bg: "#F3F4F6", label: "Not Measured" },
};

const DIVISION_LABELS: Record<string, string> = { EO: "Executive Office", GAD: "General Admin", GRO: "GRO Residential", BHC: "Behavioral Health" };
const DIVISION_COLORS: Record<string, string> = { EO: "#991B1B", GAD: "#D97706", GRO: "#245C5A", BHC: "#C45C4A" };

export function MGMAScorecardPage() {
  const { data: execData } = trpc.mgma.executiveDashboard.useQuery();
  const domains = execData?.domains ?? [];
  const divisionSummaries = execData?.divisionSummaries ?? [];
  const overall = execData?.overallKpis ?? { total: 0, onTarget: 0, atRisk: 0, offTarget: 0, notMeasured: 0 };

  const measured = overall.onTarget + overall.atRisk + overall.offTarget;
  const overallScore = measured > 0 ? Math.round((overall.onTarget / measured) * 100) : 0;

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold px-1.5 py-[2px] rounded-[2px]"
            style={{ backgroundColor: "#991B1B22", color: "#991B1B", border: "1px solid #991B1B44" }}
          >
            CO
          </span>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            MGMA Executive Scorecard
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          7-Domain Practice Management Baseline — MGMA Body of Knowledge
        </p>
      </div>

      {/* Overall Score Banner */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Overall Performance Score</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold" style={{ color: overallScore >= 80 ? "#059669" : overallScore >= 60 ? "#B45309" : "#DC2626" }}>
                {overallScore}%
              </span>
              <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                {overall.onTarget} of {measured} measured KPIs on target
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex gap-3">
              {[
                { label: "On Target", value: overall.onTarget, color: "#059669" },
                { label: "At Risk", value: overall.atRisk, color: "#B45309" },
                { label: "Off Target", value: overall.offTarget, color: "#DC2626" },
                { label: "Not Measured", value: overall.notMeasured, color: "#6B7280" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-[16px] font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px]" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full mt-3 flex overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
          {measured > 0 && (
            <>
              <div style={{ width: `${(overall.onTarget / measured) * 100}%`, backgroundColor: "#059669" }} />
              <div style={{ width: `${(overall.atRisk / measured) * 100}%`, backgroundColor: "#F59E0B" }} />
              <div style={{ width: `${(overall.offTarget / measured) * 100}%`, backgroundColor: "#DC2626" }} />
            </>
          )}
          <div style={{ width: `${(overall.notMeasured / overall.total) * 100}%`, backgroundColor: "#D1D5DB" }} />
        </div>
      </div>

      {/* Division Summaries */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {divisionSummaries.map((div) => (
          <div key={div.division} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: `${DIVISION_COLORS[div.division]}33` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIVISION_COLORS[div.division] }} />
              <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{DIVISION_LABELS[div.division] ?? div.division}</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: DIVISION_COLORS[div.division] }}>{div.score}%</div>
            <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{div.onTarget}/{div.totalKpis} KPIs on target · {div.domainCount} domains</div>
          </div>
        ))}
      </div>

      {/* 7 Domain Cards */}
      <div className="space-y-4">
        {domains.map((domain, idx) => {
          const Icon = DOMAIN_ICONS[idx] ?? Building2;
          const color = DOMAIN_COLORS[idx] ?? "#245C5A";
          const statusCfg = STATUS_CONFIG;

          return (
            <div key={domain.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold" style={{ color: "var(--topbar-title)" }}>
                      D{domain.domainNumber}: {domain.domainName}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{domain.amosOpsModule}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${DIVISION_COLORS[domain.responsibleDivision]}15`, color: DIVISION_COLORS[domain.responsibleDivision] }}>
                    {domain.responsibleDivision}
                  </span>
                  <div className="text-right">
                    <div className="text-[16px] font-bold" style={{ color }}>{domain.score}%</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{domain.onTarget}/{domain.kpiCount} KPIs</div>
                  </div>
                </div>
              </div>

              {/* Domain score bar */}
              <div className="px-4 pt-2">
                <div className="w-full h-1.5 rounded-full flex overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                  {domain.kpiCount > 0 && (
                    <>
                      <div style={{ width: `${(domain.onTarget / domain.kpiCount) * 100}%`, backgroundColor: "#059669" }} />
                      <div style={{ width: `${(domain.atRisk / domain.kpiCount) * 100}%`, backgroundColor: "#F59E0B" }} />
                      <div style={{ width: `${(domain.offTarget / domain.kpiCount) * 100}%`, backgroundColor: "#DC2626" }} />
                      <div style={{ width: `${(domain.notMeasured / domain.kpiCount) * 100}%`, backgroundColor: "#D1D5DB" }} />
                    </>
                  )}
                </div>
              </div>

              {/* KPI List */}
              <div className="p-4">
                <div className="space-y-2">
                  {domain.kpis.map((kpi: any) => {
                    const cfg = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_measured;
                    const KpiIcon = cfg.icon;
                    const targetVal = parseFloat(kpi.target);
                    const currentVal = kpi.current ? parseFloat(kpi.current) : null;
                    const displayTarget = `${kpi.target} ${kpi.unit}`;
                    const displayCurrent = kpi.current ? `${kpi.current} ${kpi.unit}` : "—";

                    return (
                      <div key={kpi.name} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ backgroundColor: `${cfg.color}06` }}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <KpiIcon size={11} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span className="text-[11px] truncate" style={{ color: "var(--topbar-title)" }}>{kpi.name}</span>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Target: {displayTarget}</div>
                            <div className="text-[11px] font-semibold" style={{ color: cfg.color }}>Current: {displayCurrent}</div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MGMAScorecardPage;
