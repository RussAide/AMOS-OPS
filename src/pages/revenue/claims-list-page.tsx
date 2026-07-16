import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {  Search, Filter, ChevronLeft, ChevronRight, FileText, ArrowLeft, X, RefreshCw, Send } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", pending: "#D97706", submitted: "#2563EB", acknowledged: "#2563EB",
  pending_review: "#D97706", approved: "#059669", denied: "#DC2626", appealed: "#7C3AED",
  paid: "#059669", write_off: "#6B7280",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending", submitted: "Submitted", acknowledged: "Acknowledged",
  pending_review: "Review", approved: "Approved", denied: "Denied", appealed: "Appealed",
  paid: "Paid", write_off: "Write Off",
};
type ClaimStatus = "pending" | "draft" | "submitted" | "approved" | "acknowledged" | "pending_review" | "denied" | "appealed" | "paid" | "write_off";

export function ClaimsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClaimStatus>("all");
  const [page, setPage] = useState(1);
  const [detailClaim, setDetailClaim] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitClaimId, setSubmitClaimId] = useState<string | null>(null);
  const [submissionMethod, setSubmissionMethod] = useState<"portal" | "fax" | "email" | "phone">("portal");
  const [submitNotes, setSubmitNotes] = useState("");
  const pageSize = 25;

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.revenue.listClaims.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize,
  });

  const { data: detailData } = trpc.revenue.getClaim.useQuery(
    { id: detailClaim ?? "" },
    { enabled: !!detailClaim }
  );

  const submitMutation = trpc.revenue.submitClaim.useMutation({
    onSuccess: () => {
      utils.revenue.listClaims.invalidate();
      setShowSubmitModal(false);
      setSubmitClaimId(null);
      setSubmitNotes("");
    },
  });

  const statuses: readonly ("all" | ClaimStatus)[] = ["all", "draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid"];
  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
              <ArrowLeft size={14} /> Back to Revenue Dashboard
            </button>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Claims</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{data?.total ?? 0} claims in system</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all hover:bg-gray-50" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
            <input type="text" placeholder="Search claim number or patient ID..." className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Filter size={14} style={{ color: "var(--topbar-subtitle)" }} />
            {statuses.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                style={{ backgroundColor: statusFilter === s ? "#245C5A" : "var(--card-bg)", color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)", border: `1px solid ${statusFilter === s ? "#245C5A" : "var(--card-border)"}` }}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                <th className="text-left px-4 py-3 font-semibold">Claim #</th>
                <th className="text-left px-4 py-3 font-semibold">Patient</th>
                <th className="text-left px-4 py-3 font-semibold">Payer</th>
                <th className="text-left px-4 py-3 font-semibold">Service Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Billed</th>
                <th className="text-right px-4 py-3 font-semibold">Paid</th>
                <th className="text-right px-4 py-3 font-semibold">Balance</th>
                <th className="text-center px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading...</td></tr>}
              {!isLoading && data?.claims.length === 0 && <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>No claims found</td></tr>}
              {data?.claims.map((claim) => {
                const balance = claim.totalAmount - (claim.paidAmount ?? 0);
                return (
                  <tr key={claim.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: `1px solid var(--card-border)` }}>
                    <td className="px-4 py-3 font-mono text-[12px] cursor-pointer" style={{ color: "#245C5A" }} onClick={() => setDetailClaim(claim.id)}>{claim.claimNumber}</td>
                    <td className="px-4 py-3">{claim.patientId}</td>
                    <td className="px-4 py-3 text-[12px]">{claim.payerName}</td>
                    <td className="px-4 py-3">{new Date(claim.serviceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[claim.status] ?? "#6B7280") + "15", color: STATUS_COLORS[claim.status] ?? "#6B7280" }}>
                        {STATUS_LABELS[claim.status] ?? claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${(claim.totalAmount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "#059669" }}>${((claim.paidAmount ?? 0) / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: balance > 0 ? "#DC2626" : "#6B7280" }}>${(balance / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {(claim.status === "draft" || claim.status === "pending") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSubmitClaimId(claim.id); setShowSubmitModal(true); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: "#245C5A", color: "#fff" }}
                        >
                          <Send size={10} /> Submit
                        </button>
                      )}
                      <button onClick={() => setDetailClaim(claim.id)} className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all hover:opacity-80" style={{ backgroundColor: "var(--card-bg)", color: "var(--topbar-title)", border: `1px solid var(--card-border)` }}>
                        <FileText size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--card-border)" }}><ChevronLeft size={16} /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--card-border)" }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Claim Detail Drawer */}
      {detailClaim && detailData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailClaim(null)}>
          <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <FileText size={18} style={{ color: "#245C5A" }} /> {detailData.claimNumber}
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setDetailClaim(null)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Status</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[detailData.status] ?? "#6B7280") + "15", color: STATUS_COLORS[detailData.status] ?? "#6B7280" }}>
                  {STATUS_LABELS[detailData.status] ?? detailData.status}
                </span>
              </div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Patient ID</span><span className="text-[13px] font-medium">{detailData.patientId}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Payer</span><span className="text-[13px] font-medium">{detailData.payerName}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Clinician</span><span className="text-[13px] font-medium">{detailData.clinicianId}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Service Date</span><span className="text-[13px] font-medium">{new Date(detailData.serviceDate).toLocaleDateString()}</span></div>
              {detailData.submissionDate && (
                <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Submission Date</span><span className="text-[13px] font-medium">{new Date(detailData.submissionDate).toLocaleDateString()}</span></div>
              )}
              <hr style={{ borderColor: "var(--card-border)" }} />
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Total Billed</span><span className="text-[13px] font-medium font-mono">${(detailData.totalAmount / 100).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Paid Amount</span><span className="text-[13px] font-medium font-mono" style={{ color: "#059669" }}>${((detailData.paidAmount ?? 0) / 100).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Balance</span><span className="text-[13px] font-bold font-mono" style={{ color: "#DC2626" }}>${((detailData.totalAmount - (detailData.paidAmount ?? 0)) / 100).toFixed(2)}</span></div>
              {detailData.denialReason && (
                <div className="rounded-lg p-3" style={{ backgroundColor: "#FEE2E2" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "#DC2626" }}>Denial Reason</p>
                  <p className="text-[12px] mt-1" style={{ color: "#991B1B" }}>{detailData.denialReason} ({detailData.denialCode})</p>
                </div>
              )}
              {detailData.lineItems && detailData.lineItems.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>Line Items ({detailData.lineItems.length})</p>
                  <div className="space-y-2">
                    {detailData.lineItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded border text-[12px]" style={{ borderColor: "var(--card-border)" }}>
                        <div>
                          <span className="font-medium">{item.procedureCode}</span>
                          <span className="mx-1" style={{ color: "var(--topbar-subtitle)" }}>&bull;</span>
                          <span style={{ color: "var(--topbar-subtitle)" }}>{item.description ?? "Service"}</span>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{item.units} unit(s) @ ${(item.unitPrice / 100).toFixed(2)}</div>
                        </div>
                        <span className="font-mono font-medium">${(item.totalPrice / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Claim Modal */}
      {showSubmitModal && submitClaimId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSubmitModal(false)}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--card-bg)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>Submit Claim</h3>
              <X size={18} className="cursor-pointer" onClick={() => setShowSubmitModal(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Submission Method</label>
                <select value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value as typeof submissionMethod)} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
                  <option value="portal">Provider Portal</option>
                  <option value="fax">Fax</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Notes (optional)</label>
                <textarea value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none resize-none" rows={3} style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} placeholder="Add submission notes..." />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 rounded-lg border text-[13px] font-medium" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>Cancel</button>
                <button onClick={() => submitMutation.mutate({ id: submitClaimId, submissionMethod, notes: submitNotes })} disabled={submitMutation.isPending} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                  {submitMutation.isPending ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ClaimsListPage;
