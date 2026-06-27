import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import {
  HeartPulse, Calendar, Users, AlertTriangle, ClipboardCheck,
  Activity, Clock, ShieldAlert, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  intake: "#2563EB",
  active: "#059669",
  hold: "#D97706",
  discharged: "#6B7280",
  transferred: "#7C3AED",
};

export function ClinicalDashboardPage() {
  const navigate = useNavigate();
  const { data: kpis } = trpc.bhc.dashboardKPIs.useQuery();
  const { data: workload } = trpc.bhc.clinicianWorkload.useQuery();
  const { data: sessionsData } = trpc.bhc.listSessions.useQuery({ status: "scheduled" });
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 5 });

  const kpiCards = [
    { label: "Total Patients", value: kpis?.totalPatients ?? 0, icon: Users, color: "#2563EB" },
    { label: "Active Cases", value: kpis?.activePatients ?? 0, icon: HeartPulse, color: "#059669" },
    { label: "Sessions Today", value: kpis?.sessionsToday ?? 0, icon: Calendar, color: "#D97706" },
    { label: "Pending Approvals", value: kpis?.pendingApprovals ?? 0, icon: ClipboardCheck, color: "#7C3AED" },
    { label: "High Risk Flags", value: kpis?.highRiskCount ?? 0, icon: ShieldAlert, color: "#DC2626" },
    { label: "Sessions This Week", value: kpis?.sessionsThisWeek ?? 0, icon: Activity, color: "#245C5A" },
  ];

  const upcomingSessions = (sessionsData ?? []).slice(0, 8);

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Clinical Dashboard
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Behavioral Health Clinical Operations Overview
            </p>
          </div>
          <button
            onClick={() => navigate("/clinical/patients")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Users size={16} />
            Patient Registry
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {card.label}
                </span>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <p className="text-[24px] font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Sessions */}
          <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Calendar size={18} style={{ color: "#245C5A" }} />
                Upcoming Sessions
              </h2>
              <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                {upcomingSessions.length} scheduled
              </span>
            </div>
            <div className="space-y-2">
              {upcomingSessions.length === 0 && (
                <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>
                  No upcoming sessions
                </p>
              )}
              {upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                  onClick={() => navigate(`/clinical/patients/${session.patientId}`)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F0FDFA" }}>
                    <Clock size={16} style={{ color: "#245C5A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                      {new Date(session.sessionDate).toLocaleString()}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {session.sessionType} &bull; {session.durationMinutes} min &bull; {session.billingCode ?? "No billing code"}
                    </p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Clinician Workload */}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[15px] font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--topbar-title)" }}>
              <Activity size={18} style={{ color: "#2563EB" }} />
              Clinician Workload
            </h2>
            <div className="space-y-3">
              {(!workload || workload.length === 0) && (
                <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>
                  No workload data
                </p>
              )}
              {workload?.map((w) => (
                <div key={w.clinicianId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                      {w.name}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {w.sessionCountThisWeek} this week
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((w.sessionCountThisWeek / 20) * 100, 100)}%`,
                          backgroundColor: w.sessionCountThisWeek > 15 ? "#DC2626" : w.sessionCountThisWeek > 10 ? "#D97706" : "#059669",
                        }}
                      />
                    </div>
                    <span className="text-[11px] w-8 text-right flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
                      {w.patientCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Patients */}
        <div className="mt-6 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={18} style={{ color: "#7C3AED" }} />
              Recent Patients
            </h2>
            <button
              onClick={() => navigate("/clinical/patients")}
              className="text-[12px] font-medium flex items-center gap-1 hover:underline"
              style={{ color: "#245C5A" }}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {patientsData?.patients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                style={{ borderColor: "var(--card-border)" }}
                onClick={() => navigate(`/clinical/patients/${patient.id}`)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[patient.status] ?? "#6B7280" }}
                >
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                    {patient.lastName}, {patient.firstName}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {patient.mrn} &bull; <span style={{ color: STATUS_COLORS[patient.status] }}>{patient.status}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
