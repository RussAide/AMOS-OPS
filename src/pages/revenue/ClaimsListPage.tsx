import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { DollarSign, Search, Filter, ChevronLeft, ChevronRight, FileText, ArrowLeft, X } from "lucide-react";

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

export function ClaimsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [detailClaim, setDetailClaim] = useState<string | null>(null);
  const pageSize = 25;

  const { data, isLoading } = trpc.revenue.listClaims.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize,
  });

  const { data: detailData } = trpc.revenue.getClaim.useQuery(
    { id: detailClaim ?? "" },
    { enabled: !!detailClaim }
  );

  const statuses = ["all", "draft", "pending", "submitted", "approved", "denied", "paid"];
  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/revenue")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
              <ArrowLeft size={14} /> Back to Revenue Dashboard
            </button>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Claims</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{data?.total ?? 0} claims in system</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
            <input type="text" placeholder="Search claims..." className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--topbar-title)" }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
                <th className="text-left px-4 py-3 font-semibold">Service Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Billed</th>
                <th className="text-right px-4 py-3 font-semibold">Paid</th>
                <th className="text-right px-4 py-3 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>Loading...</td></tr>}
              {!isLoading && data?.claims.length === 0 && <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>No claims found</td></tr>}
              {data?.claims.map((claim) => {
                const balance = claim.totalAmount - (claim.paidAmount ?? 0);
                return (
                  <tr key={claim.id} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: `1px solid var(--card-border)` }}
                    onClick={() => setDetailClaim(claim.id)}>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{claim.claimNumber}</td>
                    <td className="px-4 py-3">{new Date(claim.serviceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[claim.status] ?? "#6B7280") + "15", color: STATUS_COLORS[claim.status] ?? "#6B7280" }}>
                        {STATUS_LABELS[claim.status] ?? claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${(claim.totalAmount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "#059669" }}>${((claim.paidAmount ?? 0) / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: balance > 0 ? "#DC2626" : "#6B7280" }}>${(balance / 100).toFixed(2)}</td>
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
              <div className="flex items-center justify-between"><span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Service Date</span><span className="text-[13px] font-medium">{new Date(detailData.serviceDate).toLocaleDateString()}</span></div>
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
                  <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>Line Items</p>
                  <div className="space-y-2">
                    {detailData.lineItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded border text-[12px]" style={{ borderColor: "var(--card-border)" }}>
                        <span>{item.procedureCode} &bull; {item.description ?? "Service"}</span>
                        <span className="font-mono">${(item.totalPrice / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
