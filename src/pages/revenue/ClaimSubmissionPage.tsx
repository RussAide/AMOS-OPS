import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", pending: "#D97706", submitted: "#2563EB",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending", submitted: "Submitted",
};

export function ClaimSubmissionPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());
  const [submissionMethod, setSubmissionMethod] = useState<"portal" | "fax" | "email" | "phone">("portal");
  const [submitNotes, setSubmitNotes] = useState("");

  const { data: claims, isLoading } = trpc.revenue.listSubmittableClaims.useQuery();

  const submitMutation = trpc.revenue.submitClaim.useMutation({
    onSuccess: () => {
      utils.revenue.listSubmittableClaims.invalidate();
      setExpandedClaim(null);
    },
  });

  const batchSubmitMutation = trpc.revenue.batchSubmitClaims.useMutation({
    onSuccess: () => {
      utils.revenue.listSubmittableClaims.invalidate();
      setSelectedClaims(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedClaims);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedClaims(next);
  };

  const selectAll = () => {
    if (selectedClaims.size === (claims?.length ?? 0)) {
      setSelectedClaims(new Set());
    } else {
      setSelectedClaims(new Set(claims?.map((c) => c.id) ?? []));
    }
  };

  const totalSelected = selectedClaims.size;
  const totalAmount = claims?.filter((c) => selectedClaims.has(c.id)).reduce((s, c) => s + c.totalAmount, 0) ?? 0;

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
            <ArrowLeft size={14} /> Back to Revenue Dashboard
          </button>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Claim Submission</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{claims?.length ?? 0} claims ready to submit</p>
        </div>
      </div>

      {/* Batch submission bar */}
      {totalSelected > 0 && (
        <div className="rounded-lg border p-4 mb-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "#245C5A", backgroundColor: "#245C5A08" }}>
          <div className="flex items-center gap-3">
            <CheckCircle size={18} style={{ color: "#245C5A" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{totalSelected} claim(s) selected</span>
            <span className="text-[13px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>Total: ${(totalAmount / 100).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value as any)} className="rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}>
              <option value="portal">Provider Portal</option>
              <option value="fax">Fax</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
            <button onClick={() => batchSubmitMutation.mutate({ ids: Array.from(selectedClaims), submissionMethod })} disabled={batchSubmitMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
              <Send size={14} /> {batchSubmitMutation.isPending ? "Submitting..." : "Batch Submit"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-12 text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Loading claims...</div>}

      {!isLoading && claims?.length === 0 && (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--card-border)" }}>
          <CheckCircle size={32} style={{ color: "#059669", margin: "0 auto 12px" }} />
          <p className="text-[15px] font-medium" style={{ color: "var(--topbar-title)" }}>All claims have been submitted</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>No draft or pending claims are waiting for submission.</p>
        </div>
      )}

      <div className="space-y-2">
        {claims && claims.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <input type="checkbox" checked={totalSelected === claims.length && claims.length > 0} onChange={selectAll} className="rounded" />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Select All</span>
          </div>
        )}
        {claims?.map((claim) => (
          <div key={claim.id} className="rounded-lg border overflow-hidden transition-all" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={selectedClaims.has(claim.id)} onChange={() => toggleSelect(claim.id)} className="rounded" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-medium" style={{ color: "#245C5A" }}>{claim.claimNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[claim.status] ?? "#6B7280") + "15", color: STATUS_COLORS[claim.status] ?? "#6B7280" }}>
                    {STATUS_LABELS[claim.status] ?? claim.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span>{claim.patientId}</span>
                  <span>&bull;</span>
                  <span>{claim.payerName}</span>
                  <span>&bull;</span>
                  <span>{new Date(claim.serviceDate).toLocaleDateString()}</span>
                  <span>&bull;</span>
                  <span className="font-mono">${(claim.totalAmount / 100).toFixed(2)}</span>
                </div>
              </div>
              <button onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)} className="p-1.5 rounded-lg transition-all hover:bg-gray-100">
                {expandedClaim === claim.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
            {expandedClaim === claim.id && (
              <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: "var(--card-border)" }}>
                <div className="grid grid-cols-2 gap-3 mb-3 text-[12px]">
                  <div><span style={{ color: "var(--topbar-subtitle)" }}>Clinician:</span> <span className="font-medium">{claim.clinicianId}</span></div>
                  <div><span style={{ color: "var(--topbar-subtitle)" }}>Service Date:</span> <span className="font-medium">{new Date(claim.serviceDate).toLocaleDateString()}</span></div>
                  <div><span style={{ color: "var(--topbar-subtitle)" }}>Total Amount:</span> <span className="font-mono font-medium">${(claim.totalAmount / 100).toFixed(2)}</span></div>
                  <div><span style={{ color: "var(--topbar-subtitle)" }}>Balance:</span> <span className="font-mono font-medium" style={{ color: "#DC2626" }}>${(claim.balance / 100).toFixed(2)}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Add submission notes..." value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }} />
                  <select value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value as any)} className="rounded-lg border px-2 py-2 text-[12px] outline-none" style={{ borderColor: "var(--card-border)" }}>
                    <option value="portal">Portal</option>
                    <option value="fax">Fax</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                  <button onClick={() => submitMutation.mutate({ id: claim.id, submissionMethod, notes: submitNotes })} disabled={submitMutation.isPending} className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>
                    <Send size={12} /> Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClaimSubmissionPage;
