import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { Package, ArrowLeft, FileText, CheckCircle, AlertTriangle, X, FolderOpen } from "lucide-react";

const DOC_CATEGORIES: Record<string, { label: string; color: string }> = {
  billing: { label: "Billing", color: "#2563EB" },
  clinical: { label: "Clinical", color: "#059669" },
  legal: { label: "Legal", color: "#7C3AED" },
  review: { label: "Review", color: "#D97706" },
  compliance: { label: "Compliance", color: "#DC2626" },
};

const DOC_STATUSES = [
  { value: "included", label: "Included", color: "#059669", icon: CheckCircle },
  { value: "missing", label: "Missing", color: "#DC2626", icon: AlertTriangle },
  { value: "pending", label: "Pending", color: "#D97706", icon: FileText },
  { value: "waived", label: "Waived", color: "#6B7280", icon: X },
];

export function PayerPacketBuilderPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [selectedPayer, setSelectedPayer] = useState<string>("");
  const [selectedClaim, setSelectedClaim] = useState<string>("");
  const [documents, setDocuments] = useState<Array<{ documentType: string; documentId?: string; status: "included" | "missing" | "pending" | "waived"; notes?: string }>>([]);
  const [showSaved, setShowSaved] = useState(false);

  const { data: payers } = trpc.revenue.listPayers.useQuery();
  const { data: claims } = trpc.revenue.listClaims.useQuery({ status: "draft", pageSize: 100 });
  const { data: packetData } = trpc.revenue.getPayerPacketRequirements.useQuery(
    { payerId: selectedPayer },
    { enabled: !!selectedPayer }
  );
  const { data: existingPackets } = trpc.revenue.listPayerPackets.useQuery();

  const buildMutation = trpc.revenue.buildPayerPacket.useMutation({
    onSuccess: () => {
      utils.revenue.listPayerPackets.invalidate();
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    },
  });

  // Initialize documents from requirements when payer changes
  useState(() => {
    if (packetData?.requirements) {
      setDocuments(packetData.requirements.map((r) => ({
        documentType: r.document,
        status: r.required ? "missing" : "waived",
        notes: "",
      })));
    }
  });

  const updateDocStatus = (index: number, status: "included" | "missing" | "pending" | "waived") => {
    const next = [...documents];
    next[index] = { ...next[index], status };
    setDocuments(next);
  };

  const updateDocNotes = (index: number, notes: string) => {
    const next = [...documents];
    next[index] = { ...next[index], notes };
    setDocuments(next);
  };

  const includedCount = documents.filter((d) => d.status === "included").length;
  const missingCount = documents.filter((d) => d.status === "missing").length;
  const totalCount = documents.length;
  const readinessPct = totalCount > 0 ? Math.round(((includedCount + documents.filter((d) => d.status === "waived").length) / totalCount) * 100) : 0;

  const handleBuild = () => {
    if (!selectedClaim) return;
    buildMutation.mutate({ claimId: selectedClaim, documentsIncluded: documents });
  };

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
            <ArrowLeft size={14} /> Back to Revenue Dashboard
          </button>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Payer Packet Builder</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Assemble complete documentation packets for payer submission</p>
        </div>
      </div>

      {showSaved && (
        <div className="rounded-lg border p-3 mb-4 flex items-center gap-2" style={{ borderColor: "#05966940", backgroundColor: "#05966910" }}>
          <CheckCircle size={16} style={{ color: "#059669" }} />
          <span className="text-[13px] font-medium" style={{ color: "#059669" }}>Packet saved successfully</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Select Payer</h3>
            <select
              value={selectedPayer}
              onChange={(e) => {
                setSelectedPayer(e.target.value);
                // Init documents from requirements
                if (packetData?.requirements) {
                  setDocuments(packetData.requirements.map((r) => ({
                    documentType: r.document,
                    status: r.required ? "missing" : "waived",
                    notes: "",
                  })));
                }
              }}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="">Choose a payer...</option>
              {payers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selectedPayer && packetData?.payer && (
              <div className="mt-3 text-[12px] space-y-1" style={{ color: "var(--topbar-subtitle)" }}>
                <div>Type: <span className="font-medium capitalize">{packetData.payer.payerType}</span></div>
                {packetData.payer.contactPhone && <div>Phone: {packetData.payer.contactPhone}</div>}
                {packetData.payer.contactEmail && <div>Email: {packetData.payer.contactEmail}</div>}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Select Claim</h3>
            <select
              value={selectedClaim}
              onChange={(e) => setSelectedClaim(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="">Choose a draft claim...</option>
              {claims?.claims.map((c) => (
                <option key={c.id} value={c.id}>{c.claimNumber} — {c.patientId} (${(c.totalAmount / 100).toFixed(2)})</option>
              ))}
            </select>
          </div>

          {/* Readiness Meter */}
          {totalCount > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Packet Readiness</h3>
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={readinessPct >= 80 ? "#059669" : readinessPct >= 50 ? "#D97706" : "#DC2626"} strokeWidth="8" strokeDasharray={`${readinessPct * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[16px] font-bold" style={{ color: readinessPct >= 80 ? "#059669" : readinessPct >= 50 ? "#D97706" : "#DC2626" }}>{readinessPct}%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div><span className="font-semibold" style={{ color: "#059669" }}>{includedCount}</span> <span style={{ color: "var(--topbar-subtitle)" }}>Ready</span></div>
                <div><span className="font-semibold" style={{ color: "#DC2626" }}>{missingCount}</span> <span style={{ color: "var(--topbar-subtitle)" }}>Missing</span></div>
                <div><span className="font-semibold">{totalCount}</span> <span style={{ color: "var(--topbar-subtitle)" }}>Total</span></div>
              </div>
              <button
                onClick={handleBuild}
                disabled={!selectedClaim || buildMutation.isPending}
                className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#245C5A" }}
              >
                <Package size={14} /> {buildMutation.isPending ? "Building..." : "Save Packet"}
              </button>
            </div>
          )}
        </div>

        {/* Right: Document Checklist */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Required Documents</h3>
            {!selectedPayer && (
              <div className="text-center py-12">
                <FolderOpen size={32} style={{ color: "var(--topbar-subtitle)", margin: "0 auto 12px" }} />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Select a payer to view document requirements</p>
              </div>
            )}
            {selectedPayer && documents.length === 0 && (
              <div className="text-center py-12">
                <Package size={32} style={{ color: "var(--topbar-subtitle)", margin: "0 auto 12px" }} />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Loading requirements...</p>
              </div>
            )}
            <div className="space-y-2">
              {documents.map((doc, idx) => {
                const category = Object.entries(DOC_CATEGORIES).find(([, v]) => v.label.toLowerCase() === (packetData?.requirements[idx]?.category ?? ""))?.[1];
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: doc.status === "missing" ? "#FEE2E208" : doc.status === "included" ? "#ECFDF508" : "transparent" }}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{doc.documentType}</span>
                        {category && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: category.color + "15", color: category.color }}>
                            {category.label}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Notes..."
                        value={doc.notes ?? ""}
                        onChange={(e) => updateDocNotes(idx, e.target.value)}
                        className="mt-1 w-full bg-transparent text-[11px] outline-none"
                        style={{ color: "var(--topbar-subtitle)" }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {DOC_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => updateDocStatus(idx, s.value as Parameters<typeof updateDocStatus>[1])}
                          className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                          style={{
                            backgroundColor: doc.status === s.value ? s.color + "20" : "transparent",
                            color: doc.status === s.value ? s.color : "var(--topbar-subtitle)",
                            border: `1px solid ${doc.status === s.value ? s.color + "40" : "transparent"}`,
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Existing Packets */}
          {existingPackets && existingPackets.length > 0 && (
            <div className="rounded-lg border p-4 mt-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Saved Packets</h3>
              <div className="space-y-2">
                {existingPackets.map((pkt) => (
                  <div key={pkt.claimId} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{pkt.claimNumber}</div>
                      <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{pkt.payerName} &bull; {new Date(pkt.builtAt).toLocaleDateString()} &bull; by {pkt.builtBy}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {pkt.summary.included > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: "#05966915", color: "#059669" }}>{pkt.summary.included} ready</span>}
                      {pkt.summary.missing > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: "#DC262615", color: "#DC2626" }}>{pkt.summary.missing} missing</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PayerPacketBuilderPage;
