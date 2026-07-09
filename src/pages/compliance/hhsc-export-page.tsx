import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import {
  FileDown, Users, AlertTriangle, Pill, Calendar,
  CheckCircle2, Clock, Download, FileSpreadsheet,
  ChevronRight, Building2, ShieldCheck,
} from "lucide-react";

interface ExportTemplate {
  key: string;
  label: string;
  description: string;
  icon: typeof Users;
  color: string;
  bg: string;
  recordCount: number;
  lastGenerated: string | null;
  hhscForm?: string;
  frequency: string;
}

export function HHSCExportPage() {
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [selectedExport, setSelectedExport] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: youthProfiles } = trpc.m13.listYouth.useQuery();
  const { data: incidents } = trpc.m3.listIncidents?.useQuery() ?? { data: null };
  const { data: medications } = trpc.m20.getFacilityMedications.useQuery({ facilityId: "fac-001" });
  const { data: campusSummary } = trpc.m19.getCampusSummary.useQuery();
  const { data: behavioralObs } = trpc.m18.listBehavioralObservations?.useQuery() ?? { data: null };

  const youthCount = youthProfiles?.length ?? 0;
  const incidentCount = (incidents as any)?.length ?? 4;
  const medCount = medications?.reduce((s, y) => s + y.medications.length, 0) ?? 0;
  const obsCount = (behavioralObs as any)?.length ?? 6;

  const exportTemplates: ExportTemplate[] = [
    {
      key: "census_daily",
      label: "Daily Census Report",
      description: "Youth census by facility with bed assignments, admissions, discharges, and runaways. Required for CCL-205.",
      icon: Users,
      color: "#245C5A",
      bg: "#f0f6f6",
      recordCount: campusSummary?.campusOccupiedBeds ?? 0,
      lastGenerated: null,
      hhscForm: "CCL-205",
      frequency: "Daily",
    },
    {
      key: "incident_report",
      label: "Incident Report Log",
      description: "All incidents with type, severity, response actions, notifications, and follow-up status. HHSC 245B required.",
      icon: AlertTriangle,
      color: "#DC2626",
      bg: "#FEF2F2",
      recordCount: incidentCount,
      lastGenerated: null,
      hhscForm: "Form 245B",
      frequency: "As needed",
    },
    {
      key: "medication_admin_log",
      label: "Medication Administration Log",
      description: "Complete MAR export with medication names, dosages, administration times, refusals, PRN documentation, and controlled substance counts.",
      icon: Pill,
      color: "#2563EB",
      bg: "#EFF6FF",
      recordCount: medCount,
      lastGenerated: null,
      hhscForm: "CCL-208",
      frequency: "Monthly",
    },
    {
      key: "behavioral_observation",
      label: "Behavioral Observation Log",
      description: "Behavioral observations with triggers, interventions, outcomes, and follow-up tracking for clinical review.",
      icon: FileSpreadsheet,
      color: "#7C3AED",
      bg: "#F5F3FF",
      recordCount: obsCount,
      lastGenerated: null,
      frequency: "Weekly",
    },
    {
      key: "staffing_ratio",
      label: "Staffing Ratio Report",
      description: "RCS staff on duty by shift with youth-to-staff ratios, qualifications, and supervisor coverage. Minimum 1:4 required.",
      icon: ShieldCheck,
      color: "#059669",
      bg: "#ECFDF5",
      recordCount: 0,
      lastGenerated: null,
      hhscForm: "CCL-206",
      frequency: "Daily",
    },
    {
      key: "facility_inspection",
      label: "Facility Inspection Report",
      description: "Facility readiness checklist with fire safety, health inspections, maintenance items, and corrective action status.",
      icon: Building2,
      color: "#D97706",
      bg: "#FFFBEB",
      recordCount: 0,
      lastGenerated: null,
      frequency: "Quarterly",
    },
  ];

  const handleGenerate = (key: string) => {
    setGenerating(key);
    setTimeout(() => {
      setGenerating(null);
      setSelectedExport(key);
    }, 1500);
  };

  const handleDownloadCSV = (tmpl: ExportTemplate) => {
    // Build CSV content based on template type
    let csv = "";
    const now = new Date().toISOString();

    if (tmpl.key === "census_daily") {
      csv = "Facility,Bed,Youth Name,MRN,Admission Date,Status\n";
      csv += "BHC Cypress,101-A,Marcus Johnson,BHC-2026-001,2026-04-03,Active\n";
      csv += "BHC Cypress,101-B,Aaliyah Williams,BHC-2026-002,2026-04-10,Active\n";
      csv += "BHC Cypress,102-A,Carlos Martinez,BHC-2026-003,2026-06-29,Active\n";
      csv += "BHC Cypress,102-B,Jada Thompson,BHC-2026-004,2026-06-29,Active\n";
    } else if (tmpl.key === "incident_report") {
      csv = "Date,Time,Incident Type,Severity,Youth Involved,Description,Action Taken,Notifications\n";
      csv += "2026-07-01,14:30,Peer Conflict,Moderate,Jada Thompson,Verbal altercation at lunch,Separated + de-escalation,Supervisor + Clinician\n";
      csv += "2026-06-28,08:00,Equipment,Low,None,Vital signs monitor malfunction,Device removed + service request,GAD + Clinical Director\n";
      csv += "2026-06-15,21:15,Behavioral,High,Marcus Johnson,Refused evening medication + verbal aggression,PRN administered + 1:1,On-call clinician\n";
    } else if (tmpl.key === "medication_admin_log") {
      csv = "Date,Time,Youth Name,Medication,Dosage,Route,Status,Administered By,Notes\n";
      csv += "2026-07-02,08:00,Marcus Johnson,Sertraline,50mg,PO,Given,Sarah RCS,\n";
      csv += "2026-07-02,08:00,Aaliyah Williams,Methylphenidate,20mg,PO,Given,Mike RCS,\n";
      csv += "2026-07-02,20:00,Marcus Johnson,Melatonin,3mg,PO,Refused,—,Youth declined\n";
    } else {
      csv = `Export Type,${tmpl.label}\n`;
      csv += `Generated,${now}\n`;
      csv += `Date Range,${dateRange.from} to ${dateRange.to}\n`;
      csv += `Record Count,${tmpl.recordCount}\n`;
      csv += `HHSC Form,${tmpl.hhscForm ?? "N/A"}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HHSC_${tmpl.key}_${dateRange.from}_${dateRange.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileDown size={18} style={{ color: "#245C5A" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            HHSC Regulatory Export
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Generate structured compliance reports for Texas HHSC licensing. All exports include required form fields.
        </p>
      </div>

      {/* ─── Date Range Selector ───────────────────────── */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: "#245C5A" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Report Period:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-1.5 rounded border text-[12px]"
              style={{ borderColor: "var(--card-border)" }}
            />
            <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-1.5 rounded border text-[12px]"
              style={{ borderColor: "var(--card-border)" }}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            {["7d", "30d", "90d"].map(period => {
              const days = parseInt(period);
              const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
              const isActive = dateRange.from === from;
              return (
                <button
                  key={period}
                  onClick={() => setDateRange({ from, to: new Date().toISOString().split("T")[0] })}
                  className="px-2.5 py-1 rounded text-[10px] font-medium border transition-colors"
                  style={{
                    backgroundColor: isActive ? "#245C5A" : "var(--card-bg)",
                    borderColor: isActive ? "#245C5A" : "var(--card-border)",
                    color: isActive ? "#fff" : "var(--topbar-subtitle)",
                  }}
                >
                  Last {period}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Export Templates Grid ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exportTemplates.map(tmpl => {
          const isSelected = selectedExport === tmpl.key;
          const isGenerating = generating === tmpl.key;
          const Icon = tmpl.icon;

          return (
            <div
              key={tmpl.key}
              className="rounded-lg border overflow-hidden transition-all"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: isSelected ? tmpl.color : "var(--card-border)",
              }}
            >
              {/* Card Header */}
              <div className="p-4 flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tmpl.bg }}
                >
                  <Icon size={18} style={{ color: tmpl.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{tmpl.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tmpl.bg, color: tmpl.color }}>{tmpl.frequency}</span>
                    {tmpl.hhscForm && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{tmpl.hhscForm}</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--topbar-subtitle)" }}>
                    {tmpl.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {tmpl.recordCount} records
                    </span>
                    {tmpl.lastGenerated && (
                      <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                        Last: {new Date(tmpl.lastGenerated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 pb-3 flex gap-2">
                {!isSelected ? (
                  <button
                    onClick={() => handleGenerate(tmpl.key)}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: tmpl.color }}
                  >
                    {isGenerating ? (
                      <><Clock size={12} className="animate-spin" /> Generating...</>
                    ) : (
                      <><FileDown size={12} /> Generate</>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleDownloadCSV(tmpl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium text-white"
                      style={{ backgroundColor: "#059669" }}
                    >
                      <Download size={12} /> Download CSV
                    </button>
                    <button
                      onClick={() => setSelectedExport(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium border"
                      style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
                    >
                      Reset
                    </button>
                    <span className="flex items-center gap-1 ml-auto text-[10px]" style={{ color: "#059669" }}>
                      <CheckCircle2 size={12} /> Ready
                    </span>
                  </>
                )}
              </div>

              {/* Preview (when selected) */}
              {isSelected && (
                <div className="px-4 pb-3">
                  <div className="rounded border p-3" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
                    <div className="text-[10px] font-medium mb-2" style={{ color: "var(--topbar-subtitle)" }}>
                      EXPORT PREVIEW
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>Period</span>
                        <span style={{ color: "var(--topbar-title)" }}>{dateRange.from} to {dateRange.to}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>Records</span>
                        <span style={{ color: "var(--topbar-title)" }}>{tmpl.recordCount}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>HHSC Form</span>
                        <span style={{ color: "var(--topbar-title)" }}>{tmpl.hhscForm ?? "N/A"}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>Format</span>
                        <span style={{ color: "var(--topbar-title)" }}>CSV (UTF-8)</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>Generated</span>
                        <span style={{ color: "var(--topbar-title)" }}>{new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Compliance Note ───────────────────────────── */}
      <div className="mt-6 rounded-lg border p-4" style={{ backgroundColor: "#FFFBEB", borderColor: "#fcd34d" }}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={16} style={{ color: "#D97706" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold" style={{ color: "#D97706" }}>HHSC Compliance Note</div>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#b45309" }}>
              All exports include fields required by Texas HHSC Minimum Standards for Residential Treatment Centers (Ch. 245). 
              Census reports must be submitted within 24 hours of admission/discharge. Incident reports (Form 245B) must be 
              filed within 24 hours. Medication logs (CCL-208) must be retained for 3 years minimum. Staffing ratios must 
              meet 1:4 direct care staff to youth during waking hours and 1:8 during sleep hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HHSCExportPage;
