import { trpc } from "@/providers/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Brain,
  HeartPulse,
} from "lucide-react";
import { useState } from "react";
import { BHC_DEPARTMENTS, DIVISIONS } from "@/constants/organization";

const DEPT_COLORS = {
  ccmg: { bg: "#FDF2F8", border: "#FBCFE8", text: "#BE185D", icon: "#DB2777" },
  mhtcm: { bg: "#F0FDFA", border: "#99F6E4", text: "#0F766E", icon: "#14B8A6" },
  mhrs: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", icon: "#3B82F6" },
};

export function BHCDashboardPage() {
  const { data: dashboard } = trpc.ccmg.bhcDashboard.useQuery();
  const { data: mhtcmDashboard } = trpc.mhtcm.mhtcmDashboard.useQuery();
  const { data: mhrsDashboard } = trpc.mhrs.mhrsDashboard.useQuery();
  const [activeDept, setActiveDept] = useState<
    "ccmg" | "mhtcm" | "mhrs" | "all"
  >("all");

  const bhc = dashboard;
  const mhtcm = mhtcmDashboard;
  const mhrs = mhrsDashboard;

  // Enterprise summary cards
  const summaryCards = [
    {
      label: "CCMG Active Cases",
      value: bhc?.ccmg?.activeCases ?? 0,
      sub: `${bhc?.ccmg?.intakeCases ?? 0} in intake`,
      icon: Building2,
      color: "#DB2777",
      dept: "ccmg" as const,
    },
    {
      label: "MHTCM Active Plans",
      value: mhtcm?.activePlans ?? 0,
      sub: `${mhtcm?.overduePlans ?? 0} overdue`,
      icon: Brain,
      color: "#14B8A6",
      dept: "mhtcm" as const,
    },
    {
      label: "MHRS Active Programs",
      value: mhrs?.plans?.active ?? 0,
      sub: `${mhrs?.plans?.overdue ?? 0} overdue`,
      icon: HeartPulse,
      color: "#3B82F6",
      dept: "mhrs" as const,
    },
    {
      label: "Pending Referrals",
      value: bhc?.referrals?.pending ?? 0,
      sub: `${bhc?.referrals?.groToBhcPending ?? 0} GRO→BHC`,
      icon: ArrowRight,
      color: "#D97706",
      dept: "all" as const,
    },
  ];

  const filteredCards =
    activeDept === "all"
      ? summaryCards
      : summaryCards.filter((c) => c.dept === activeDept || c.dept === "all");

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold px-1.5 py-[2px] rounded-[2px]"
            style={{
              backgroundColor: "#C45C4A22",
              color: "#C45C4A",
              border: "1px solid #C45C4A44",
            }}
          >
            PC
          </span>
          <h1
            className="text-[22px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {DIVISIONS.bhc.name}
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          CCMG · MHTCM · MHRS — 3-department unified view
        </p>
      </div>

      {/* Department Filter Tabs */}
      <div
        className="flex gap-1 mb-6 border-b overflow-x-auto"
        style={{ borderColor: "var(--card-border)" }}
      >
        {[
          { key: "all" as const, label: "All Departments", icon: Activity },
          { key: "ccmg" as const, label: "CCMG", icon: Building2 },
          { key: "mhtcm" as const, label: "MHTCM", icon: Brain },
          { key: "mhrs" as const, label: "MHRS", icon: HeartPulse },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveDept(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors flex-shrink-0"
            style={{
              borderColor:
                activeDept === tab.key
                  ? DEPT_COLORS[tab.key === "all" ? "ccmg" : tab.key].text
                  : "transparent",
              color:
                activeDept === tab.key
                  ? DEPT_COLORS[tab.key === "all" ? "ccmg" : tab.key].text
                  : "var(--topbar-subtitle)",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {filteredCards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
            onClick={() =>
              setActiveDept(c.dept === "all" ? activeDept : c.dept)
            }
          >
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} style={{ color: c.color }} />
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {c.label}
              </span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: c.color }}>
              {c.value}
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Three Department Cards */}
      {(activeDept === "all" || activeDept === "ccmg") && (
        <div
          className="rounded-lg border mb-4 overflow-hidden"
          style={{
            borderColor: DEPT_COLORS.ccmg.border,
            backgroundColor: DEPT_COLORS.ccmg.bg,
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: DEPT_COLORS.ccmg.border }}
          >
            <div className="flex items-center gap-2">
              <Building2 size={18} style={{ color: DEPT_COLORS.ccmg.icon }} />
              <span
                className="text-[14px] font-bold"
                style={{ color: DEPT_COLORS.ccmg.text }}
              >
                {BHC_DEPARTMENTS.ccmg.shortName} — {BHC_DEPARTMENTS.ccmg.name}
              </span>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#DB277722", color: "#BE185D" }}
            >
              {bhc?.ccmg?.totalCases ?? 0} total cases
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: "Active", value: bhc?.ccmg?.activeCases ?? 0 },
                { label: "Intake", value: bhc?.ccmg?.intakeCases ?? 0 },
                { label: "Assessment Review", value: "Governed" },
                {
                  label: "Pending Referrals",
                  value: bhc?.ccmg?.pendingReferrals ?? 0,
                },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div
                    className="text-[16px] font-bold"
                    style={{ color: DEPT_COLORS.ccmg.text }}
                  >
                    {s.value}
                  </div>
                  <div className="text-[10px]" style={{ color: "#9D174D" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(activeDept === "all" || activeDept === "mhtcm") && (
        <div
          className="rounded-lg border mb-4 overflow-hidden"
          style={{
            borderColor: DEPT_COLORS.mhtcm.border,
            backgroundColor: DEPT_COLORS.mhtcm.bg,
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: DEPT_COLORS.mhtcm.border }}
          >
            <div className="flex items-center gap-2">
              <Brain size={18} style={{ color: DEPT_COLORS.mhtcm.icon }} />
              <span
                className="text-[14px] font-bold"
                style={{ color: DEPT_COLORS.mhtcm.text }}
              >
                {BHC_DEPARTMENTS.mhtcm.shortName} — {BHC_DEPARTMENTS.mhtcm.name}
              </span>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#14B8A622", color: "#0F766E" }}
            >
              T1017 billing
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: "Active Plans", value: mhtcm?.activePlans ?? 0 },
                {
                  label: "Overdue Plans",
                  value: mhtcm?.overduePlans ?? 0,
                  alert: (mhtcm?.overduePlans ?? 0) > 0,
                },
                {
                  label: "Encounters This Month",
                  value: mhtcm?.encountersThisMonth ?? 0,
                },
                {
                  label: "T1017 Units",
                  value: mhtcm?.totalUnitsThisMonth ?? 0,
                },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div
                    className="text-[16px] font-bold"
                    style={{
                      color: s.alert ? "#DC2626" : DEPT_COLORS.mhtcm.text,
                    }}
                  >
                    {s.value}
                  </div>
                  <div className="text-[10px]" style={{ color: "#0F766E" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {/* Units by function */}
            {mhtcm?.unitsByFunction &&
              Object.keys(mhtcm.unitsByFunction).length > 0 && (
                <div className="mt-2">
                  <div
                    className="text-[10px] font-medium mb-1"
                    style={{ color: "#0F766E" }}
                  >
                    Units by Function (This Month)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mhtcm.unitsByFunction).map(
                      ([fn, units]) => (
                        <span
                          key={fn}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "#14B8A618",
                            color: "#0F766E",
                          }}
                        >
                          {fn}: {units as number} units
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            {(mhtcm?.overduePlans ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 text-[11px] px-3 py-2 rounded mt-2"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
              >
                <AlertTriangle size={12} /> {mhtcm?.overduePlans} service
                plan(s) past 14-day deadline
              </div>
            )}
          </div>
        </div>
      )}

      {(activeDept === "all" || activeDept === "mhrs") && (
        <div
          className="rounded-lg border mb-4 overflow-hidden"
          style={{
            borderColor: DEPT_COLORS.mhrs.border,
            backgroundColor: DEPT_COLORS.mhrs.bg,
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: DEPT_COLORS.mhrs.border }}
          >
            <div className="flex items-center gap-2">
              <HeartPulse size={18} style={{ color: DEPT_COLORS.mhrs.icon }} />
              <span
                className="text-[14px] font-bold"
                style={{ color: DEPT_COLORS.mhrs.text }}
              >
                {BHC_DEPARTMENTS.mhrs.shortName} — {BHC_DEPARTMENTS.mhrs.name}
              </span>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#3B82F622", color: "#1D4ED8" }}
            >
              H2017 billing
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: "Active Plans", value: mhrs?.plans?.active ?? 0 },
                {
                  label: "Overdue Plans",
                  value: mhrs?.plans?.overdue ?? 0,
                  alert: (mhrs?.plans?.overdue ?? 0) > 0,
                },
                {
                  label: "Encounters This Month",
                  value: mhrs?.encounters?.thisMonth ?? 0,
                },
                {
                  label: "H2017 Units",
                  value: mhrs?.encounters?.unitsThisMonth ?? 0,
                },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div
                    className="text-[16px] font-bold"
                    style={{
                      color: s.alert ? "#DC2626" : DEPT_COLORS.mhrs.text,
                    }}
                  >
                    {s.value}
                  </div>
                  <div className="text-[10px]" style={{ color: "#1D4ED8" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {/* Category breakdown */}
            {mhrs?.categories && (
              <div className="mt-2">
                <div
                  className="text-[10px] font-medium mb-1"
                  style={{ color: "#1D4ED8" }}
                >
                  Category Completion
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    {
                      label: "Psychosocial",
                      completed: mhrs?.categories?.psychoCompleted ?? 0,
                      total: mhrs?.plans?.total ?? 0,
                    },
                    {
                      label: "Skills Training",
                      completed: mhrs?.categories?.skillsCompleted ?? 0,
                      total: mhrs?.plans?.total ?? 0,
                    },
                    {
                      label: "Supportive",
                      completed: mhrs?.categories?.supportiveCompleted ?? 0,
                      total: mhrs?.plans?.total ?? 0,
                    },
                    {
                      label: "Community",
                      completed: mhrs?.categories?.communityCompleted ?? 0,
                      total: mhrs?.plans?.total ?? 0,
                    },
                  ].map((cat) => (
                    <div
                      key={cat.label}
                      className="text-center px-2 py-1 rounded"
                      style={{ backgroundColor: "#3B82F60D" }}
                    >
                      <div
                        className="text-[12px] font-semibold"
                        style={{ color: DEPT_COLORS.mhrs.text }}
                      >
                        {cat.completed}/{cat.total}
                      </div>
                      <div className="text-[9px]" style={{ color: "#1D4ED8" }}>
                        {cat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(mhrs?.skills?.avgProgressPercentage ?? 0) > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: "#1D4ED8" }}
                  >
                    Avg. Skills Progress
                  </span>
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: DEPT_COLORS.mhrs.text }}
                  >
                    {mhrs?.skills?.avgProgressPercentage}%
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full"
                  style={{ backgroundColor: "#DBEAFE" }}
                >
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(mhrs?.skills?.avgProgressPercentage ?? 0, 100)}%`,
                      backgroundColor: "#3B82F6",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cross-Divisional Referrals */}
      {activeDept === "all" && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[13px] font-semibold mb-3 flex items-center gap-2"
            style={{ color: "var(--topbar-title)" }}
          >
            <ArrowRight size={14} style={{ color: "#D97706" }} />{" "}
            Cross-Divisional Referrals
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "Total This Week",
                value: bhc?.referrals?.totalThisWeek ?? 0,
              },
              {
                label: "Pending",
                value: bhc?.referrals?.pending ?? 0,
                alert: true,
              },
              {
                label: "GRO → BHC Pending",
                value: bhc?.referrals?.groToBhcPending ?? 0,
                alert: true,
              },
            ].map((r) => (
              <div
                key={r.label}
                className="text-center p-2 rounded"
                style={{
                  backgroundColor: r.alert ? "#FEF2F210" : "var(--card-bg)",
                  border: `1px solid ${r.alert ? "#FECACA" : "var(--card-border)"}`,
                }}
              >
                <div
                  className="text-[16px] font-bold"
                  style={{ color: r.alert ? "#DC2626" : "var(--topbar-title)" }}
                >
                  {r.value}
                </div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BHCDashboardPage;
