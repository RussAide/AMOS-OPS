import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Globe2, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2,
  XCircle, ArrowUpRight, BarChart3, ShieldCheck, Search, Eye,
  Smartphone, FileText, Zap, Accessibility, Type, Image, AlertOctagon,
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Eye }> = {
  Accessibility: { label: "Accessibility", color: "#7C3AED", bg: "#F5F3FF", icon: Accessibility },
  SEO: { label: "SEO", color: "#2563EB", bg: "#EFF6FF", icon: Search },
  Performance: { label: "Performance", color: "#0891B2", bg: "#ecfeff", icon: Zap },
  Content: { label: "Content", color: "#D97706", bg: "#FFFBEB", icon: FileText },
  Mobile: { label: "Mobile", color: "#059669", bg: "#ECFDF5", icon: Smartphone },
  Security: { label: "Security", color: "#991B1B", bg: "#FEF2F2", icon: ShieldCheck },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "#059669" },
  good: { label: "Good", color: "#0891B2" },
  acceptable: { label: "Acceptable", color: "#2563EB" },
  needs_work: { label: "Needs Work", color: "#D97706" },
  critical: { label: "Critical", color: "#DC2626" },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#DC2626", bg: "#FEF2F2", label: "Critical" },
  high: { color: "#D97706", bg: "#FFFBEB", label: "High" },
  medium: { color: "#2563EB", bg: "#EFF6FF", label: "Medium" },
  low: { color: "#6B7280", bg: "#F3F4F6", label: "Low" },
};

export function MarketingSiteReviewPage() {
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: reviewData, refetch } = trpc.analytics.marketingSiteReview.useQuery();
  const scanMutation = trpc.analytics.runMarketingScan.useMutation({
    onSuccess: () => refetch(),
  });

  const categories = reviewData?.categories ?? [];
  const pages = reviewData?.pages ?? [];
  const recentIssues = reviewData?.recentIssues ?? [];

  const filteredIssues = categoryFilter
    ? recentIssues.filter((i: any) => i.category === categoryFilter)
    : recentIssues;

  const selectedPageData = pages.find((p: any) => p.url === selectedPage);
  const selectedPageIssues = recentIssues.filter((i: any) => i.page === selectedPage);

  const overallScore = reviewData?.overallScore ?? 0;

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Globe2 size={22} style={{ color: "#245C5A" }} /> Marketing Site Review
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Automated quality audit for public-facing website
          </p>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#245C5A" }}
        >
          <RefreshCw size={16} className={scanMutation.isPending ? "animate-spin" : ""} />
          {scanMutation.isPending ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {/* Overall Score */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center rounded-full" style={{
              background: `conic-gradient(${overallScore >= 80 ? "#059669" : overallScore >= 60 ? "#D97706" : "#DC2626"} ${overallScore * 3.6}deg, #e5e7eb 0deg)`,
            }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--card-bg)" }}>
                <span className="text-[16px] font-bold" style={{ color: overallScore >= 80 ? "#059669" : overallScore >= 60 ? "#D97706" : "#DC2626" }}>{overallScore}</span>
              </div>
            </div>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Overall Site Score</div>
              <div className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                Last reviewed: {reviewData?.lastReviewed ? new Date(reviewData.lastReviewed).toLocaleDateString() : "—"} by {reviewData?.reviewer ?? "—"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: any) => {
              const cfg = CATEGORY_CONFIG[cat.name] ?? { label: cat.name, color: "#6B7280", bg: "#F3F4F6", icon: Eye };
              const Icon = cfg.icon;
              return (
                <button
                  key={cat.name}
                  onClick={() => setCategoryFilter(categoryFilter === cat.name ? "" : cat.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all"
                  style={{
                    borderColor: categoryFilter === cat.name ? cfg.color : "var(--card-border)",
                    backgroundColor: categoryFilter === cat.name ? cfg.bg : "var(--card-bg)",
                    color: cfg.color,
                  }}
                >
                  <Icon size={12} />
                  {cfg.label}: {cat.score}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {categories.map((cat: any) => {
          const cfg = CATEGORY_CONFIG[cat.name] ?? { label: cat.name, color: "#6B7280", bg: "#F3F4F6", icon: Eye };
          const Icon = cfg.icon;
          const st = STATUS_CONFIG[cat.status] ?? { label: cat.status, color: "#6B7280" };
          return (
            <div
              key={cat.name}
              onClick={() => setCategoryFilter(categoryFilter === cat.name ? "" : cat.name)}
              className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
              style={{
                borderColor: categoryFilter === cat.name ? cfg.color : "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={14} style={{ color: cfg.color }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{cfg.label}</span>
              </div>
              <div className="text-[20px] font-bold" style={{ color: cfg.color }}>{cat.score}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.color + "15", color: st.color }}>
                  {st.label}
                </span>
                <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{cat.issues} issues</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pages List */}
        <div>
          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <FileText size={14} style={{ color: "#245C5A" }} /> Pages Scanned
          </h3>
          <div className="space-y-2">
            {pages.map((page: any) => {
              const pageColor = page.score >= 80 ? "#059669" : page.score >= 60 ? "#D97706" : "#DC2626";
              return (
                <div
                  key={page.url}
                  onClick={() => setSelectedPage(page.url === selectedPage ? null : page.url)}
                  className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    borderColor: selectedPage === page.url ? "#245C5A" : "var(--card-border)",
                    backgroundColor: selectedPage === page.url ? "#245C5A08" : "var(--card-bg)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowUpRight size={14} style={{ color: pageColor }} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{page.title}</div>
                        <div className="text-[10px] truncate" style={{ color: "var(--topbar-subtitle)" }}>{page.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[14px] font-bold" style={{ color: pageColor }}>{page.score}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: page.issues > 10 ? "#FEF2F2" : page.issues > 5 ? "#FFFBEB" : "#ECFDF5", color: page.issues > 10 ? "#DC2626" : page.issues > 5 ? "#D97706" : "#059669" }}>
                        {page.issues} issues
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues Panel */}
        <div>
          {selectedPage ? (
            <>
              <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Eye size={14} style={{ color: "#245C5A" }} /> {selectedPageData?.title} Issues
              </h3>
              <div className="space-y-2 mb-4">
                {selectedPageIssues.length === 0 ? (
                  <div className="rounded-lg border p-4 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                    <CheckCircle2 size={24} className="mx-auto mb-1" style={{ color: "#059669" }} />
                    <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>No issues found for this page</p>
                  </div>
                ) : (
                  selectedPageIssues.map((issue: any) => {
                    const sev = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.low;
                    return (
                      <div key={issue.id} className="rounded-lg border p-3" style={{ borderColor: sev.color + "30", backgroundColor: sev.bg }}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} style={{ color: sev.color, flexShrink: 0 }} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-[11px] font-semibold" style={{ color: sev.color }}>{issue.category}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: sev.color + "20", color: sev.color }}>{sev.label}</span>
                            </div>
                            <p className="text-[11px]" style={{ color: "var(--topbar-title)" }}>{issue.description}</p>
                            <p className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Reported {new Date(issue.reportedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : null}

          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <AlertOctagon size={14} style={{ color: "#DC2626" }} /> {categoryFilter ? `${categoryFilter} Issues` : "Recent Issues"}
          </h3>
          <div className="space-y-2">
            {filteredIssues.length === 0 ? (
              <div className="rounded-lg border p-4 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <CheckCircle2 size={24} className="mx-auto mb-1" style={{ color: "#059669" }} />
                <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>No issues match the selected filter</p>
              </div>
            ) : (
              filteredIssues.map((issue: any) => {
                const sev = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.low;
                return (
                  <div key={issue.id} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} style={{ color: sev.color, flexShrink: 0 }} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{issue.page}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: sev.bg, color: sev.color }}>{issue.severity}</span>
                          <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{issue.category}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{issue.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketingSiteReviewPage;
