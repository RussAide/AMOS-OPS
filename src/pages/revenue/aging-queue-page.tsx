import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowLeft, X, Building2, FileText } from "lucide-react";

const BUCKET_COLORS: Record<string, string> = {
  "0-30 Days": "#059669",
  "31-60 Days": "#D97706",
  "61-90 Days": "#DC2626",
  "91-120 Days": "#991B1B",
  "120+ Days": "#7F1D1D",
};

export function AgingQueuePage() {
  const navigate = useNavigate();
  const [detailBucket, setDetailBucket] = useState<string | null>(null);
  const [detailClaim, setDetailClaim] = useState<string | null>(null);
  const [payerView, setPayerView] = useState(false);

  const { data } = trpc.revenue.agingReport.useQuery();
  const { data: payerAging } = trpc.revenue.agingQueueByPayer.useQuery();

  const selectedClaim = data?.detailClaims.find((c) => c.id === detailClaim);

  const totalOutstanding = data?.buckets.reduce((s, b) => s + b.total, 0) ?? 0;
  const totalCount = data?.buckets.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
              <ArrowLeft size={14} /> Back to Revenue Dashboard
            </button>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Aging Queue</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>${(totalOutstanding / 100).toLocaleString()} outstanding across {totalCount} claims</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPayerView(false)} className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${!payerView ? "text-white" : ""}`} style={{ backgroundColor: !payerView ? "#245C5A" : "var(--card-bg)", color: payerView ? "var(--topbar-subtitle)" : undefined, border: `1px solid ${!payerView ? "#245C5A" : "var(--card-border)"}` }}>Summary</button>
            <button onClick={() => setPayerView(true)} className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${payerView ? "text-white" : ""}`} style={{ backgroundColor: payerView ? "#245C5A" : "var(--card-bg)", color: !payerView ? "var(--topbar-subtitle)" : undefined, border: `1px solid ${payerView ? "#245C5A" : "var(--card-border)"}` }}>By Payer</button>
          </div>
        </div>

        {!payerView && (
          <>
            {/* Bucket Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {data?.buckets.map((bucket) => (
                <button
                  key={bucket.label}
                  onClick={() => setDetailBucket(detailBucket === bucket.label ? null : bucket.label)}
                  className="rounded-lg border p-4 text-left transition-all hover:shadow-md"
                  style={{ borderColor: BUCKET_COLORS[bucket.label] + "40", backgroundColor: BUCKET_COLORS[bucket.label] + "08" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} style={{ color: BUCKET_COLORS[bucket.label] }} />
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: BUCKET_COLORS[bucket.label] }}>{bucket.label}</span>
                  </div>
                  <p className="text-[20px] font-bold" style={{ color: BUCKET_COLORS[bucket.label] }}>${(bucket.total / 100).toLocaleString()}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{bucket.count} claim(s)</p>
                </button>
              ))}
            </div>

            {/* Aging Bar */}
            <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Aging Distribution</h3>
              <div className="h-6 rounded-full overflow-hidden flex">
                {data?.buckets.map((bucket) => {
                  const pct = totalOutstanding > 0 ? (bucket.total / totalOutstanding) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={bucket.label}
                      className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all cursor-pointer hover:opacity-80"
                      style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: BUCKET_COLORS[bucket.label] }}
                      title={`${bucket.label}: $${(bucket.total / 100).toLocaleString()}`}
                    >
                      {pct > 10 ? `${Math.round(pct)}%` : ""}
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {data?.buckets.map((bucket) => (
                  <div key={bucket.label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BUCKET_COLORS[bucket.label] }} />
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{bucket.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Claims Detail for Selected Bucket */}
            {detailBucket && data?.detailClaims && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{detailBucket} Claims</h3>
                  <button onClick={() => setDetailBucket(null)} className="p-1 rounded hover:bg-gray-100"><X size={14} /></button>
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                      <th className="text-left px-4 py-2 font-semibold">Claim #</th>
                      <th className="text-left px-4 py-2 font-semibold">Patient</th>
                      <th className="text-left px-4 py-2 font-semibold">Payer</th>
                      <th className="text-left px-4 py-2 font-semibold">Days</th>
                      <th className="text-right px-4 py-2 font-semibold">Balance</th>
                      <th className="text-center px-4 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.detailClaims
                      .filter((c) => {
                        if (detailBucket === "0-30 Days") return c.daysDiff <= 30;
                        if (detailBucket === "31-60 Days") return c.daysDiff > 30 && c.daysDiff <= 60;
                        if (detailBucket === "61-90 Days") return c.daysDiff > 60 && c.daysDiff <= 90;
                        if (detailBucket === "91-120 Days") return c.daysDiff > 90 && c.daysDiff <= 120;
                        return c.daysDiff > 120;
                      })
                      .map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50 cursor-pointer transition-colors" style={{ borderBottom: `1px solid var(--card-border)` }} onClick={() => setDetailClaim(claim.id)}>
                          <td className="px-4 py-2 font-mono text-[11px]" style={{ color: "#245C5A" }}>{claim.claimNumber}</td>
                          <td className="px-4 py-2">{claim.patientId}</td>
                          <td className="px-4 py-2 text-[11px]">{claim.payerName}</td>
                          <td className="px-4 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: BUCKET_COLORS[detailBucket] + "15", color: BUCKET_COLORS[detailBucket] }}>
                              {claim.daysDiff}d
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono" style={{ color: "#DC2626" }}>${(claim.balance / 100).toFixed(2)}</td>
                          <td className="px-4 py-2 text-center">
                            <FileText size={14} className="inline" style={{ color: "var(--topbar-subtitle)" }} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {payerView && payerAging && (
          <div className="space-y-4">
            {payerAging.map((payer) => (
              <div key={payer.payerName} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid var(--card-border)` }}>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} style={{ color: "#245C5A" }} />
                    <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{payer.payerName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize" style={{ backgroundColor: "#245C5A15", color: "#245C5A" }}>{payer.payerType}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-mono font-bold" style={{ color: "#DC2626" }}>${(payer.total / 100).toLocaleString()}</span>
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{payer.count} claims</span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="h-4 rounded-full overflow-hidden flex">
                    {Object.entries(payer.buckets).map(([label, amount]) => {
                      const pct = payer.total > 0 ? (amount / payer.total) * 100 : 0;
                      return pct > 0 ? (
                        <div key={label} className="h-full" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: BUCKET_COLORS[label] ?? "#6B7280" }} title={`${label}: $${(amount / 100).toLocaleString()}`} />
                      ) : null;
                    })}
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-2 text-center">
                    {Object.entries(payer.buckets).map(([label, amount]) => (
                      <div key={label}>
                        <span className="text-[11px] font-medium" style={{ color: BUCKET_COLORS[label] }}>${(amount / 100).toLocaleString()}</span>
                        <p className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claim Detail Drawer */}
      {detailClaim && selectedClaim && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailClaim(null)}>
          <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <FileText size={18} style={{ color: "#245C5A" }} /> {selectedClaim.claimNumber}
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setDetailClaim(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Patient</span><span className="text-[13px] font-medium">{selectedClaim.patientId}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Payer</span><span className="text-[13px] font-medium">{selectedClaim.payerName}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Days Outstanding</span><span className="text-[13px] font-bold" style={{ color: selectedClaim.daysDiff > 90 ? "#DC2626" : "#D97706" }}>{selectedClaim.daysDiff} days</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Balance</span><span className="text-[13px] font-bold font-mono" style={{ color: "#DC2626" }}>${(selectedClaim.balance / 100).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Status</span><span className="text-[13px] font-medium">{selectedClaim.status}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Service Date</span><span className="text-[13px] font-medium">{new Date(selectedClaim.serviceDate).toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AgingQueuePage;
