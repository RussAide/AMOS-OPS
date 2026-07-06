import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Search, Plus, X, CheckCircle, AlertTriangle, Clock, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "#6B7280", in_progress: "#D97706", submitted: "#2563EB",
  approved: "#059669", denied: "#DC2626", appealed: "#7C3AED",
  expired: "#6B7280", closed: "#6B7280",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", in_progress: "In Progress", submitted: "Submitted",
  approved: "Approved", denied: "Denied", appealed: "Appealed",
  expired: "Expired", closed: "Closed",
};

const STAGE_LABELS: Record<string, string> = {
  readiness: "Readiness", submission: "Submission", tracking: "Tracking",
  reauthorization: "Reauthorization", retrospective: "Retrospective",
};

const STAGE_COLORS: Record<string, string> = {
  readiness: "#D97706", submission: "#2563EB", tracking: "#059669",
  reauthorization: "#7C3AED", retrospective: "#6B7280",
};

const READINESS_FIELDS = [
  { key: "readinessClinicalDocs", label: "Clinical Documentation" },
  { key: "readinessAssessmentCurrent", label: "Assessment Current (< 6mo)" },
  { key: "readinessLOCSupported", label: "LOC Clinically Supported" },
  { key: "readinessTreatmentPlan", label: "Treatment Plan Current" },
  { key: "readinessProgressNotes", label: "Progress Notes Current" },
  { key: "readinessMedicalNecessity", label: "Medical Necessity Documented" },
  { key: "readinessUtilizationReview", label: "Utilization Review Complete" },
  { key: "readinessGuardianConsent", label: "Guardian Consent Obtained" },
  { key: "readinessUB04Clean", label: "UB-04 Data Clean" },
  { key: "readinessExcludedServices", label: "Excluded Services Identified" },
];

export function AuthorizationManagementPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [detailAuth, setDetailAuth] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    youthId: "", youthName: "", mrn: "", payerName: "", policyNumber: "",
    stage: "readiness" as const, status: "pending" as const, approvedLevelOfCare: "",
  });

  const { data, isLoading } = trpc.revenue.listAuthorizations.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    stage: stageFilter === "all" ? undefined : stageFilter,
    search: search || undefined,
    page,
    pageSize: 25,
  });

  const { data: detailData } = trpc.revenue.getAuthorization.useQuery(
    { id: detailAuth ?? "" },
    { enabled: !!detailAuth }
  );

  const createMutation = trpc.revenue.createAuthorization.useMutation({
    onSuccess: () => {
      utils.revenue.listAuthorizations.invalidate();
      setShowCreate(false);
      setFormData({ youthId: "", youthName: "", mrn: "", payerName: "", policyNumber: "", stage: "readiness", status: "pending", approvedLevelOfCare: "" });
    },
  });

  const updateMutation = trpc.revenue.updateAuthorization.useMutation({
    onSuccess: () => {
      utils.revenue.listAuthorizations.invalidate();
      utils.revenue.getAuthorization.invalidate();
    },
  });

  const deleteMutation = trpc.revenue.deleteAuthorization.useMutation({
    onSuccess: () => {
      utils.revenue.listAuthorizations.invalidate();
      setDetailAuth(null);
    },
  });

  const statuses = ["all", "pending", "in_progress", "submitted", "approved", "denied", "expired"];
  const stages = ["all", "readiness", "submission", "tracking", "reauthorization", "retrospective"];

  const toggleReadiness = (field: string) => {
    if (!detailData) return;
    const current = (detailData as any)[field] as boolean;
    updateMutation.mutate({ id: detailData.id, [field]: !current });
  };

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
              <ArrowLeft size={14} /> Back to Revenue Dashboard
            </button>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Authorization Management</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{data?.total ?? 0} authorizations in system</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={14} /> New Authorization
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
            <input type="text" placeholder="Search youth name, MRN, or payer..." className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {statuses.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                style={{ backgroundColor: statusFilter === s ? "#245C5A" : "var(--card-bg)", color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)", border: `1px solid ${statusFilter === s ? "#245C5A" : "var(--card-border)"}` }}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {stages.map((s) => (
              <button key={s} onClick={() => { setStageFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                style={{ backgroundColor: stageFilter === s ? STAGE_COLORS[s] ?? "#245C5A" : "var(--card-bg)", color: stageFilter === s ? "#fff" : "var(--topbar-subtitle)", border: `1px solid ${stageFilter === s ? STAGE_COLORS[s] ?? "#245C5A" : "var(--card-border)"}` }}>
                {s === "all" ? "Stage: All" : STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                <th className="text-left px-4 py-3 font-semibold">Youth</th>
                <th className="text-left px-4 py-3 font-semibold">MRN</th>
                <th className="text-left px-4 py-3 font-semibold">Payer</th>
                <th className="text-left px-4 py-3 font-semibold">Stage</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Auth #</th>
                <th className="text-right px-4 py-3 font-semibold">Units</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading...</td></tr>}
              {!isLoading && data?.authorizations.length === 0 && <tr><td colSpan={8} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>No authorizations found</td></tr>}
              {data?.authorizations.map((auth) => (
                <tr key={auth.id} className="hover:bg-gray-50 cursor-pointer transition-colors" style={{ borderBottom: `1px solid var(--card-border)` }} onClick={() => setDetailAuth(auth.id)}>
                  <td className="px-4 py-3 font-medium">{auth.youthName}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{auth.mrn}</td>
                  <td className="px-4 py-3 text-[12px]">{auth.payerName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STAGE_COLORS[auth.stage] ?? "#6B7280") + "15", color: STAGE_COLORS[auth.stage] ?? "#6B7280" }}>
                      {STAGE_LABELS[auth.stage] ?? auth.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[auth.status] ?? "#6B7280") + "15", color: STATUS_COLORS[auth.status] ?? "#6B7280" }}>
                      {STATUS_LABELS[auth.status] ?? auth.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">{auth.authorizationNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{auth.approvedUnits ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: auth.id }); }} className="p-1 rounded hover:bg-red-50 transition-colors" style={{ color: "#DC2626" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>New Authorization</h3>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              {[
                { key: "youthId", label: "Youth ID", placeholder: "e.g. youth-001" },
                { key: "youthName", label: "Youth Name", placeholder: "Full name" },
                { key: "mrn", label: "MRN", placeholder: "Medical Record Number" },
                { key: "payerName", label: "Payer Name", placeholder: "Insurance provider" },
                { key: "policyNumber", label: "Policy Number", placeholder: "Optional" },
                { key: "approvedLevelOfCare", label: "Level of Care", placeholder: "e.g. Residential, IOP" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>{field.label}</label>
                  <input type="text" placeholder={field.placeholder} value={(formData as any)[field.key]} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Stage</label>
                  <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border text-[13px] font-medium" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>Cancel</button>
                <button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.youthId || !formData.youthName || !formData.mrn || !formData.payerName} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                  {createMutation.isPending ? "Creating..." : "Create Authorization"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailAuth && detailData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailAuth(null)}>
          <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Shield size={18} style={{ color: "#245C5A" }} /> Authorization
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setDetailAuth(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            <div className="space-y-4">
              {/* Youth Info */}
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--topbar-subtitle)" }}>Youth</p>
                <div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium">{detailData.youthName}</span></div>
                <div className="text-[12px] space-y-1" style={{ color: "var(--topbar-subtitle)" }}>
                  <div>ID: {detailData.youthId}</div>
                  <div>MRN: {detailData.mrn}</div>
                </div>
              </div>

              {/* Payer Info */}
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--topbar-subtitle)" }}>Payer</p>
                <div className="text-[13px] font-medium">{detailData.payerName}</div>
                {detailData.policyNumber && <div className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Policy: {detailData.policyNumber}</div>}
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Stage</p>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STAGE_COLORS[detailData.stage] ?? "#6B7280") + "15", color: STAGE_COLORS[detailData.stage] ?? "#6B7280" }}>
                    {STAGE_LABELS[detailData.stage] ?? detailData.stage}
                  </span>
                </div>
                <div className="flex-1 rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Status</p>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[detailData.status] ?? "#6B7280") + "15", color: STATUS_COLORS[detailData.status] ?? "#6B7280" }}>
                    {STATUS_LABELS[detailData.status] ?? detailData.status}
                  </span>
                </div>
              </div>

              {/* Approval Details */}
              {detailData.authorizationNumber && (
                <div className="rounded-lg border p-4" style={{ borderColor: "#05966940", backgroundColor: "#05966908" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#059669" }}>Approval Details</p>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div><span style={{ color: "var(--topbar-subtitle)" }}>Auth #:</span> <span className="font-mono">{detailData.authorizationNumber}</span></div>
                    <div><span style={{ color: "var(--topbar-subtitle)" }}>Units:</span> <span className="font-medium">{detailData.approvedUnits}</span></div>
                    <div><span style={{ color: "var(--topbar-subtitle)" }}>From:</span> <span>{detailData.approvedFromDate ? new Date(detailData.approvedFromDate).toLocaleDateString() : "—"}</span></div>
                    <div><span style={{ color: "var(--topbar-subtitle)" }}>To:</span> <span>{detailData.approvedToDate ? new Date(detailData.approvedToDate).toLocaleDateString() : "—"}</span></div>
                    <div className="col-span-2"><span style={{ color: "var(--topbar-subtitle)" }}>Level of Care:</span> <span className="font-medium">{detailData.approvedLevelOfCare ?? "—"}</span></div>
                  </div>
                </div>
              )}

              {/* Reauthorization Warning */}
              {detailData.reauthStatus && detailData.reauthStatus !== "not_due" && (
                <div className={`rounded-lg border p-4 ${detailData.reauthStatus === "overdue" ? "bg-red-50" : "bg-amber-50"}`} style={{ borderColor: detailData.reauthStatus === "overdue" ? "#DC262640" : "#D9770640" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {detailData.reauthStatus === "overdue" ? <AlertTriangle size={14} style={{ color: "#DC2626" }} /> : <Clock size={14} style={{ color: "#D97706" }} />}
                    <p className="text-[12px] font-semibold" style={{ color: detailData.reauthStatus === "overdue" ? "#DC2626" : "#D97706" }}>
                      Reauthorization {detailData.reauthStatus === "overdue" ? "Overdue" : "Upcoming"}
                    </p>
                  </div>
                  <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                    Due: {detailData.reauthDueDate ? new Date(detailData.reauthDueDate).toLocaleDateString() : "Not set"}
                    {detailData.daysUntilExpiration !== null && <span className="ml-2">({detailData.daysUntilExpiration} days)</span>}
                  </p>
                </div>
              )}

              {/* Readiness Checklist */}
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--topbar-subtitle)" }}>Readiness Checklist</p>
                <div className="space-y-2">
                  {READINESS_FIELDS.map((field) => {
                    const checked = !!(detailData as any)[field.key];
                    return (
                      <button key={field.key} onClick={() => toggleReadiness(field.key)} className="w-full flex items-center gap-2 text-left text-[12px] p-2 rounded-lg transition-all hover:bg-gray-50">
                        {checked ? <CheckCircle size={14} style={{ color: "#059669" }} /> : <div className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: "#D1D5DB" }} />}
                        <span className={checked ? "font-medium" : ""} style={{ color: checked ? "var(--topbar-title)" : "var(--topbar-subtitle)" }}>{field.label}</span>
                      </button>
                    );
                  })}
                </div>
                {detailData.readinessMetAt && (
                  <p className="text-[11px] mt-3 flex items-center gap-1" style={{ color: "#059669" }}>
                    <CheckCircle size={12} /> Readiness met on {new Date(detailData.readinessMetAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <select value={detailData.status} onChange={(e) => updateMutation.mutate({ id: detailData.id, status: e.target.value as any })} className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={detailData.stage} onChange={(e) => updateMutation.mutate({ id: detailData.id, stage: e.target.value as any })} className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => { if (confirm("Delete this authorization?")) deleteMutation.mutate({ id: detailData.id }); }} className="p-2 rounded-lg border hover:bg-red-50 transition-colors" style={{ borderColor: "#DC262640", color: "#DC2626" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AuthorizationManagementPage;
