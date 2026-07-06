import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Search, CheckCircle, XCircle, AlertTriangle, FileText, ChevronRight, RefreshCw, Lock } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  validation: "#2563EB",
  clinical: "#059669",
  compliance: "#7C3AED",
  billing: "#D97706",
};

const CATEGORY_LABELS: Record<string, string> = {
  validation: "Validation",
  clinical: "Clinical",
  compliance: "Compliance",
  billing: "Billing",
};

export function ProofOfServiceGatePage() {
  const navigate = useNavigate();
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: claimsData } = trpc.revenue.listClaims.useQuery({ pageSize: 100 });

  const { data: posStatus, isLoading: posLoading, refetch: refetchPos } = trpc.revenue.getProofOfServiceStatus.useQuery(
    { claimId: selectedClaimId },
    { enabled: !!selectedClaimId }
  );

  const filteredClaims = claimsData?.claims.filter((c) =>
    !searchTerm ||
    c.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.patientId.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const allPassed = posStatus?.status === "cleared";
  const failedChecks = posStatus?.checks.filter((c) => !c.passed && c.required) ?? [];
  const optionalFailed = posStatus?.checks.filter((c) => !c.passed && !c.required) ?? [];

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
            <ArrowLeft size={14} /> Back to Revenue Dashboard
          </button>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Proof-of-Service Gate</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Validate claims before submission — all required checks must pass</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Claim Selector */}
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Select Claim</h3>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mb-3" style={{ borderColor: "var(--card-border)" }}>
              <Search size={14} style={{ color: "var(--topbar-subtitle)" }} />
              <input
                type="text"
                placeholder="Search claim number or patient..."
                className="flex-1 bg-transparent text-[12px] outline-none"
                style={{ color: "var(--topbar-title)" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredClaims.map((claim) => (
                <button
                  key={claim.id}
                  onClick={() => setSelectedClaimId(claim.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: selectedClaimId === claim.id ? "#245C5A15" : "transparent",
                    border: `1px solid ${selectedClaimId === claim.id ? "#245C5A40" : "transparent"}`,
                  }}
                >
                  <div>
                    <div className="text-[12px] font-mono font-medium" style={{ color: selectedClaimId === claim.id ? "#245C5A" : "var(--topbar-title)" }}>{claim.claimNumber}</div>
                    <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{claim.patientId} &bull; {claim.payerName}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: selectedClaimId === claim.id ? "#245C5A" : "var(--topbar-subtitle)" }} />
                </button>
              ))}
              {filteredClaims.length === 0 && (
                <p className="text-[12px] text-center py-4" style={{ color: "var(--topbar-subtitle)" }}>No claims found</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {posStatus && (
            <div className="rounded-lg border p-4" style={{ borderColor: allPassed ? "#05966940" : "#DC262640", backgroundColor: allPassed ? "#05966908" : "#FEE2E208" }}>
              <div className="flex items-center gap-2 mb-3">
                {allPassed ? <ShieldCheck size={18} style={{ color: "#059669" }} /> : <Lock size={18} style={{ color: "#DC2626" }} />}
                <span className="text-[13px] font-semibold" style={{ color: allPassed ? "#059669" : "#DC2626" }}>
                  {allPassed ? "Cleared for Submission" : "Blocked — Issues Found"}
                </span>
              </div>
              <div className="text-[12px] space-y-1" style={{ color: "var(--topbar-subtitle)" }}>
                <div className="flex items-center justify-between">
                  <span>Required Passed</span>
                  <span className="font-medium" style={{ color: posStatus.summary.requiredPassed === posStatus.summary.requiredTotal ? "#059669" : "#DC2626" }}>
                    {posStatus.summary.requiredPassed}/{posStatus.summary.requiredTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Passed</span>
                  <span className="font-medium">{posStatus.summary.passed}/{posStatus.summary.total}</span>
                </div>
              </div>
              {!allPassed && failedChecks.length > 0 && (
                <div className="mt-3 rounded p-2 text-[11px]" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                  {failedChecks.length} required {failedChecks.length === 1 ? "check" : "checks"} failing
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Gate Checks */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Gate Checks</h3>
              {selectedClaimId && (
                <button onClick={() => refetchPos()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all hover:bg-gray-50" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>
                  <RefreshCw size={12} /> Re-run
                </button>
              )}
            </div>

            {!selectedClaimId && (
              <div className="text-center py-16">
                <ShieldCheck size={40} style={{ color: "var(--topbar-subtitle)", margin: "0 auto 16px", opacity: 0.5 }} />
                <p className="text-[14px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Select a claim to run the Proof-of-Service gate</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>All validation checks will be performed against the selected claim</p>
              </div>
            )}

            {selectedClaimId && posLoading && (
              <div className="text-center py-12 text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Running checks...</div>
            )}

            {posStatus && (
              <div className="space-y-2">
                {posStatus.checks.map((check, idx) => {
                  const catColor = CATEGORY_COLORS[check.category] ?? "#6B7280";
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg border transition-all"
                      style={{
                        borderColor: check.passed ? "#05966920" : check.required ? "#DC262620" : "#D9770620",
                        backgroundColor: check.passed ? "#05966905" : check.required ? "#FEE2E205" : "#FEF3C705",
                      }}
                    >
                      <div className="flex-shrink-0">
                        {check.passed ? (
                          <CheckCircle size={18} style={{ color: "#059669" }} />
                        ) : check.required ? (
                          <XCircle size={18} style={{ color: "#DC2626" }} />
                        ) : (
                          <AlertTriangle size={18} style={{ color: "#D97706" }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium" style={{ color: check.passed ? "var(--topbar-title)" : check.required ? "#DC2626" : "#D97706" }}>
                            {check.gate}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase" style={{ backgroundColor: catColor + "15", color: catColor }}>
                            {CATEGORY_LABELS[check.category] ?? check.category}
                          </span>
                          {check.required && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#DC262615", color: "#DC2626" }}>Required</span>
                          )}
                          {!check.required && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#D9770615", color: "#D97706" }}>Optional</span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: check.passed ? "#059669" : check.required ? "#DC2626" : "#D97706" }}>
                          {check.passed ? "Passed" : check.required ? "Failed — must be resolved before submission" : "Warning — recommended to fix"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gate Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              <div className="flex items-center gap-1"><CheckCircle size={12} style={{ color: "#059669" }} /> <span>Passed</span></div>
              <div className="flex items-center gap-1"><XCircle size={12} style={{ color: "#DC2626" }} /> <span>Required Failed</span></div>
              <div className="flex items-center gap-1"><AlertTriangle size={12} style={{ color: "#D97706" }} /> <span>Optional Warning</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProofOfServiceGatePage;
