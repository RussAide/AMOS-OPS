import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { Ban, ArrowLeft, TrendingUp, AlertTriangle, ShieldAlert, RotateCcw, X, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  denied: "#DC2626", appealed: "#7C3AED",
};

const STATUS_LABELS: Record<string, string> = {
  denied: "Denied", appealed: "Appealed",
};

export function DenialManagementPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [detailClaim, setDetailClaim] = useState<string | null>(null);
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealDocs, setAppealDocs] = useState("");

  const { data: deniedClaims, isLoading } = trpc.revenue.listDeniedClaims.useQuery();
  const { data: analytics } = trpc.revenue.getDenialAnalytics.useQuery();

  const appealMutation = trpc.revenue.appealClaim.useMutation({
    onSuccess: () => {
      utils.revenue.listDeniedClaims.invalidate();
      utils.revenue.getDenialAnalytics.invalidate();
      setShowAppeal(false);
      setAppealReason("");
      setAppealDocs("");
    },
  });

  const updateAppealMutation = trpc.revenue.updateAppealStatus.useMutation({
    onSuccess: () => {
      utils.revenue.listDeniedClaims.invalidate();
      utils.revenue.getDenialAnalytics.invalidate();
      setDetailClaim(null);
    },
  });

  const detailClaimData = deniedClaims?.find((c) => c.id === detailClaim);

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
              <ArrowLeft size={14} /> Back to Revenue Dashboard
            </button>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Denial Management</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Track, analyze, and appeal denied claims</p>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Ban size={14} style={{ color: "#DC2626" }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Total Denied</span>
            </div>
            <p className="text-[22px] font-bold" style={{ color: "#DC2626" }}>{analytics?.totalDenied ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} style={{ color: "#D97706" }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Denied Amount</span>
            </div>
            <p className="text-[22px] font-bold" style={{ color: "#D97706" }}>${((analytics?.totalDeniedAmount ?? 0) / 100).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={14} style={{ color: "#7C3AED" }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Under Appeal</span>
            </div>
            <p className="text-[22px] font-bold" style={{ color: "#7C3AED" }}>{analytics?.appealedCount ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: "#245C5A" }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>Top Denial Code</span>
            </div>
            <p className="text-[18px] font-bold" style={{ color: "#245C5A" }}>{analytics?.byCode[0]?.code ?? "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Denial by Code */}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Denial Reasons</h3>
            <div className="space-y-2">
              {analytics?.byCode.map((code) => (
                <div key={code.code} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div>
                    <span className="text-[12px] font-mono font-medium" style={{ color: "#DC2626" }}>{code.code}</span>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{code.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold">{code.count}</span>
                    <p className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>${(code.totalAmount / 100).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(!analytics?.byCode.length) && <p className="text-[12px] text-center py-4" style={{ color: "var(--topbar-subtitle)" }}>No denial data</p>}
            </div>
          </div>

          {/* Denied Claims List */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Denied Claims</h3>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{deniedClaims?.length ?? 0} claims</span>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                    <th className="text-left px-4 py-2 font-semibold">Claim #</th>
                    <th className="text-left px-4 py-2 font-semibold">Patient</th>
                    <th className="text-left px-4 py-2 font-semibold">Payer</th>
                    <th className="text-left px-4 py-2 font-semibold">Status</th>
                    <th className="text-right px-4 py-2 font-semibold">Amount</th>
                    <th className="text-center px-4 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading...</td></tr>}
                  {!isLoading && deniedClaims?.length === 0 && <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>No denied claims</td></tr>}
                  {deniedClaims?.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-50 cursor-pointer transition-colors" style={{ borderBottom: `1px solid var(--card-border)` }} onClick={() => setDetailClaim(claim.id)}>
                      <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "#245C5A" }}>{claim.claimNumber}</td>
                      <td className="px-4 py-3">{claim.patientId}</td>
                      <td className="px-4 py-3 text-[12px]">{claim.payerName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[claim.status] ?? "#6B7280") + "15", color: STATUS_COLORS[claim.status] ?? "#6B7280" }}>
                          {STATUS_LABELS[claim.status] ?? claim.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">${(claim.totalAmount / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {claim.status === "denied" ? (
                          <button onClick={(e) => { e.stopPropagation(); setDetailClaim(claim.id); setShowAppeal(true); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#7C3AED15", color: "#7C3AED" }}>
                            <RotateCcw size={10} /> Appeal
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: "#7C3AED" }}>In Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {detailClaim && detailClaimData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => { setDetailClaim(null); setShowAppeal(false); }}>
          <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Ban size={18} style={{ color: "#DC2626" }} /> {detailClaimData.claimNumber}
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => { setDetailClaim(null); setShowAppeal(false); }} style={{ color: "var(--topbar-subtitle)" }} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Status</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[detailClaimData.status] ?? "#6B7280") + "15", color: STATUS_COLORS[detailClaimData.status] ?? "#6B7280" }}>
                  {STATUS_LABELS[detailClaimData.status] ?? detailClaimData.status}
                </span>
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: "#FEE2E2" }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: "#DC2626" }}>Denial Details</p>
                <p className="text-[13px] font-medium" style={{ color: "#991B1B" }}>{detailClaimData.denialReason ?? "No reason provided"}</p>
                {detailClaimData.denialCode && <p className="text-[12px] font-mono mt-1" style={{ color: "#DC2626" }}>Code: {detailClaimData.denialCode}</p>}
              </div>

              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Patient</span><span className="text-[13px] font-medium">{detailClaimData.patientId}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Payer</span><span className="text-[13px] font-medium">{detailClaimData.payerName}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Service Date</span><span className="text-[13px] font-medium">{new Date(detailClaimData.serviceDate).toLocaleDateString()}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Total Amount</span><span className="text-[13px] font-mono font-medium">${(detailClaimData.totalAmount / 100).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Balance</span><span className="text-[13px] font-mono font-bold" style={{ color: "#DC2626" }}>${(detailClaimData.balance / 100).toFixed(2)}</span></div>

              {detailClaimData.appealDate && (
                <div className="rounded-lg p-3" style={{ backgroundColor: "#EDE9FE" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "#7C3AED" }}>Appeal Submitted</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{new Date(detailClaimData.appealDate).toLocaleDateString()}</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Status: <span className="font-medium">{detailClaimData.appealStatus}</span></p>
                </div>
              )}

              {detailClaimData.status === "appealed" && (
                <div className="pt-2">
                  <p className="text-[12px] font-medium mb-2" style={{ color: "var(--topbar-title)" }}>Update Appeal Status</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateAppealMutation.mutate({ id: detailClaimData.id, appealStatus: "approved" })} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium" style={{ backgroundColor: "#05966915", color: "#059669" }}>
                      <CheckCircle size={12} /> Approved
                    </button>
                    <button onClick={() => updateAppealMutation.mutate({ id: detailClaimData.id, appealStatus: "denied" })} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium" style={{ backgroundColor: "#DC262615", color: "#DC2626" }}>
                      <Ban size={12} /> Denied
                    </button>
                  </div>
                </div>
              )}

              {detailClaimData.status === "denied" && !showAppeal && (
                <button onClick={() => setShowAppeal(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#7C3AED" }}>
                  <RotateCcw size={14} /> File Appeal
                </button>
              )}

              {showAppeal && (
                <div className="rounded-lg border p-4" style={{ borderColor: "#7C3AED40" }}>
                  <p className="text-[13px] font-semibold mb-3" style={{ color: "#7C3AED" }}>File Appeal</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Appeal Reason *</label>
                      <textarea value={appealReason} onChange={(e) => setAppealReason(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none resize-none" rows={3} style={{ borderColor: "var(--card-border)" }} placeholder="Explain why this denial should be overturned..." />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Supporting Documentation</label>
                      <input type="text" value={appealDocs} onChange={(e) => setAppealDocs(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }} placeholder="Document references..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowAppeal(false)} className="flex-1 px-3 py-2 rounded-lg border text-[12px] font-medium" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>Cancel</button>
                      <button onClick={() => { if (appealReason) appealMutation.mutate({ id: detailClaimData.id, appealReason, appealDocumentation: appealDocs }); }} disabled={!appealReason || appealMutation.isPending} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium text-white transition-all disabled:opacity-50" style={{ backgroundColor: "#7C3AED" }}>
                        {appealMutation.isPending ? "Filing..." : "Submit Appeal"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DenialManagementPage;
