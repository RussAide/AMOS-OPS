import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Package2 as Package, Search, Filter, X, FileText, Clock, CheckCircle, AlertCircle,
  BarChart3, Users, Activity, TrendingUp, Calendar
} from "lucide-react";

const DOC_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", signed: "#2563EB", submitted: "#059669",
};
const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", signed: "Signed", submitted: "Submitted",
};

export function ServiceDeliveryPage() {
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTab, setSelectedTab] = useState<"mhtcm" | "mhrs" | "clinical">("mhtcm");

  const { data: deliveryData, isLoading } = trpc.bhc.getServiceDeliverySummary.useQuery(
    (dateFrom || dateTo) ? { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } : undefined
  );

  const summary = deliveryData?.summary;

  const mhtcmEncounters = (deliveryData?.mhtcmEncounters ?? []).filter((e) => {
    if (docFilter !== "all" && e.documentationStatus !== docFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.clinicalNotes?.toLowerCase().includes(q) ?? false) || e.youthName.toLowerCase().includes(q);
  });
  const mhrsEncounters = (deliveryData?.mhrsEncounters ?? []).filter((e) => {
    if (docFilter !== "all" && e.documentationStatus !== docFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.clinicalNotes?.toLowerCase().includes(q) ?? false) || e.youthName.toLowerCase().includes(q);
  });
  const clinicalSessions = (deliveryData?.clinicalSessions ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.chiefComplaint?.toLowerCase().includes(q) ?? false) || (s.sessionNotes?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Service Delivery</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            {(summary?.mhtcmCount ?? 0) + (summary?.mhrsCount ?? 0) + (summary?.clinicalCount ?? 0)} total encounters
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} style={{ color: "#245C5A" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>MHTCM (T1017)</span>
            </div>
            <p className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>{summary.mhtcmCount}</p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{summary.totalMhtcmUnits} units billed</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} style={{ color: "#245C5A" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>MHRS (H2017)</span>
            </div>
            <p className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>{summary.mhrsCount}</p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{summary.totalMhrsUnits} units billed</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} style={{ color: "#245C5A" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Clinical</span>
            </div>
            <p className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>{summary.clinicalCount}</p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{Math.round(summary.totalClinicalMinutes / 60)} hrs total</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} style={{ color: "#059669" }} />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Documentation</span>
            </div>
            <p className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              {summary.mhtcmDocumentation.submitted + summary.mhrsDocumentation.submitted}
            </p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Draft: {summary.mhtcmDocumentation.draft + summary.mhrsDocumentation.draft}
            </p>
          </div>
        </div>
      )}

      {/* Doc Status Breakdown */}
      {summary && (
        <div className="rounded-lg border p-3 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>Documentation Status Breakdown</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>MHTCM</p>
              <div className="flex gap-1 h-4 rounded-full overflow-hidden">
                {summary.mhtcmCount > 0 && (
                  <>
                    <div className="h-full" style={{ width: `${(summary.mhtcmDocumentation.draft / summary.mhtcmCount) * 100}%`, backgroundColor: "#6B7280" }} />
                    <div className="h-full" style={{ width: `${(summary.mhtcmDocumentation.signed / summary.mhtcmCount) * 100}%`, backgroundColor: "#2563EB" }} />
                    <div className="h-full" style={{ width: `${(summary.mhtcmDocumentation.submitted / summary.mhtcmCount) * 100}%`, backgroundColor: "#059669" }} />
                  </>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>MHRS</p>
              <div className="flex gap-1 h-4 rounded-full overflow-hidden">
                {summary.mhrsCount > 0 && (
                  <>
                    <div className="h-full" style={{ width: `${(summary.mhrsDocumentation.draft / summary.mhrsCount) * 100}%`, backgroundColor: "#6B7280" }} />
                    <div className="h-full" style={{ width: `${(summary.mhrsDocumentation.signed / summary.mhrsCount) * 100}%`, backgroundColor: "#2563EB" }} />
                    <div className="h-full" style={{ width: `${(summary.mhrsDocumentation.submitted / summary.mhrsCount) * 100}%`, backgroundColor: "#059669" }} />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            {["draft", "signed", "submitted"].map((s) => (
              <span key={s} className="text-[10px] flex items-center gap-1" style={{ color: DOC_STATUS_COLORS[s] }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: DOC_STATUS_COLORS[s] }} /> {DOC_STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search..."
            className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <X size={14} className="cursor-pointer" onClick={() => setSearch("")} style={{ color: "var(--topbar-subtitle)" }} />}
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={14} style={{ color: "var(--topbar-subtitle)" }} />
          <input type="date" className="rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>to</span>
          <input type="date" className="rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}
            value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          {["all", "draft", "signed", "submitted"].map((s) => (
            <button key={s} onClick={() => setDocFilter(s)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
              style={{
                backgroundColor: docFilter === s ? "#245C5A" : "var(--card-bg)",
                color: docFilter === s ? "#fff" : "var(--topbar-subtitle)",
                border: `1px solid ${docFilter === s ? "#245C5A" : "var(--card-border)"}`,
              }}>
              {s === "all" ? "All" : DOC_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        {(["mhtcm", "mhrs", "clinical"] as const).map((tab) => (
          <button key={tab} onClick={() => setSelectedTab(tab)}
            className="px-4 py-2 text-[13px] font-medium transition-all relative"
            style={{ color: selectedTab === tab ? "#245C5A" : "var(--topbar-subtitle)" }}>
            {tab.toUpperCase()}
            {selectedTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "#245C5A" }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading...</p>
      ) : (
        <>
          {selectedTab === "mhtcm" && (
            mhtcmEncounters.length === 0 ? (
              <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <FileText size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No MHTCM encounters found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mhtcmEncounters.map((e) => (
                  <div key={e.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{e.youthName}</span>
                        <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{e.mrn}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: (DOC_STATUS_COLORS[e.documentationStatus ?? "draft"] ?? "#6B7280") + "15",
                            color: DOC_STATUS_COLORS[e.documentationStatus ?? "draft"] ?? "#6B7280" }}>
                          {DOC_STATUS_LABELS[e.documentationStatus ?? "draft"]}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {new Date(e.encounterDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      <span>{e.encounterType}</span>
                      <span>{e.unitsBilled ?? 0} units</span>
                      <span>Duration: {e.durationMinutes} min</span>
                      {e.isSignatureRequired && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={10} /> Sig Required</span>}
                    </div>
                    {e.clinicalNotes && (
                      <p className="text-[12px] mt-2 line-clamp-2" style={{ color: "var(--topbar-subtitle)" }}>{e.clinicalNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          {selectedTab === "mhrs" && (
            mhrsEncounters.length === 0 ? (
              <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <Activity size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No MHRS encounters found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mhrsEncounters.map((e) => (
                  <div key={e.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{e.youthName}</span>
                        <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{e.mrn}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: (DOC_STATUS_COLORS[e.documentationStatus ?? "draft"] ?? "#6B7280") + "15",
                            color: DOC_STATUS_COLORS[e.documentationStatus ?? "draft"] ?? "#6B7280" }}>
                          {DOC_STATUS_LABELS[e.documentationStatus ?? "draft"]}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {new Date(e.encounterDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      <span>{e.encounterType}</span>
                      <span>{e.unitsBilled ?? 0} units</span>
                      <span>Duration: {e.durationMinutes} min</span>
                    </div>
                    {e.skillsTaught && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.skillsTaught.split(",").map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>{s.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          {selectedTab === "clinical" && (
            clinicalSessions.length === 0 ? (
              <div className="text-center py-12 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <FileText size={32} style={{ color: "var(--topbar-subtitle)" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No clinical sessions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clinicalSessions.map((s) => (
                  <div key={s.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{new Date(s.sessionDate).toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>{s.sessionType ?? "Session"}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: (s.status === "completed" ? "#059669" : s.status === "scheduled" ? "#2563EB" : "#6B7280") + "15",
                            color: s.status === "completed" ? "#059669" : s.status === "scheduled" ? "#2563EB" : "#6B7280" }}>
                          {s.status}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{s.durationMinutes} min</span>
                    </div>
                    {s.chiefComplaint && <p className="text-[13px] font-medium mb-1" style={{ color: "var(--topbar-title)" }}>{s.chiefComplaint}</p>}
                    {s.sessionNotes && <p className="text-[12px] line-clamp-2" style={{ color: "var(--topbar-subtitle)" }}>{s.sessionNotes}</p>}
                    {s.billingCode && <span className="text-[11px] font-mono mt-1 inline-block" style={{ color: "var(--topbar-subtitle)" }}>{s.billingCode}</span>}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

export default ServiceDeliveryPage;
