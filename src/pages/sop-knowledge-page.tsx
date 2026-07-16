import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BookOpen, Search, FileText, Scale, GraduationCap, ClipboardList, ExternalLink, BookMarked, Tag } from "lucide-react";
import { PageLayout } from "@/components/shell/page-layout";

const TABS = [
  { key: "sop", label: "SOP Library", icon: ClipboardList },
  { key: "policies", label: "Policies", icon: Scale },
  { key: "training", label: "Training", icon: GraduationCap },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Professional Standards": "#245C5A",
  Safety: "#DC2626",
  Intake: "#2563EB",
  Clinical: "#059669",
  Care: "#0891B2",
  GRO: "#D97706",
  Operations: "#7C3AED",
  Compliance: "#991B1B",
  Revenue: "#0891B2",
  HR: "#4F46E5",
};

export function SOPKnowledgePage() {
  const [activeTab, setActiveTab] = useState("sop");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedSOP, setSelectedSOP] = useState<string | null>(null);

  const { data: sopItems } = trpc.analytics.listSOPs.useQuery();
  const { data: regulatoryRefs } = trpc.analytics.listRegulatoryRefs.useQuery();
  const { data: sopDetail } = trpc.analytics.getSOP.useQuery(
    { id: selectedSOP ?? "" },
    { enabled: !!selectedSOP }
  );

  const items = sopItems ?? [];
  const refs = regulatoryRefs ?? [];

  const filteredSOP = items.filter((s) => {
    if (search && !s.title?.toLowerCase().includes(search.toLowerCase()) && !s.category?.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    return true;
  });

  const categories = [...new Set(items.map((s) => s.category))];

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <BookOpen size={22} style={{ color: "#245C5A" }} /> Knowledge & SOP Library
        </h1>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Standard operating procedures, regulatory references, and training materials
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors" style={{ borderColor: activeTab === tab.key ? "#245C5A" : "transparent", color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)" }}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sop" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SOPs..." className="w-full pl-9 pr-3 py-2 rounded-lg border text-[12px]" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--topbar-title)" }} />
            </div>
            {/* Category filters */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <button onClick={() => setCategoryFilter("")} className="text-[10px] px-2 py-1 rounded-full font-medium transition-all" style={{ backgroundColor: categoryFilter === "" ? "#245C5A" : "#f1f5f9", color: categoryFilter === "" ? "#fff" : "#64748b" }}>
                  All
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)} className="text-[10px] px-2 py-1 rounded-full font-medium transition-all" style={{ backgroundColor: categoryFilter === cat ? (CATEGORY_COLORS[cat] ?? "#245C5A") : "#f1f5f9", color: categoryFilter === cat ? "#fff" : (CATEGORY_COLORS[cat] ?? "#64748b") }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {filteredSOP.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSOP(s.id === selectedSOP ? null : s.id)}
                  className="rounded-lg border p-3 flex items-center gap-3 hover:border-[#245C5A] transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selectedSOP === s.id ? "#245C5A08" : "var(--card-bg)",
                    borderColor: selectedSOP === s.id ? "#245C5A" : "var(--card-border)",
                  }}
                >
                  <FileText size={16} style={{ color: CATEGORY_COLORS[s.category] ?? "#245C5A" }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{s.title}</span>
                      {s.status === "review" && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FFFBEB", color: "#B45309" }}>Under Review</span>}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{s.id} &middot; {s.category} &middot; Updated {new Date(s.updated).toLocaleDateString()}</div>
                  </div>
                  <ExternalLink size={12} style={{ color: "var(--topbar-subtitle)" }} />
                </div>
              ))}
            </div>
            {filteredSOP.length === 0 && <p className="text-center py-8 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>No SOPs match your search</p>}
          </div>

          {/* SOP Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedSOP || !sopDetail ? (
              <div className="rounded-lg border p-6 text-center sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <BookMarked size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>Select an SOP</p>
                <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Click an SOP item to view details.</p>
              </div>
            ) : (
              <div className="rounded-lg border sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (CATEGORY_COLORS[sopDetail.category] ?? "#245C5A") + "15", color: CATEGORY_COLORS[sopDetail.category] ?? "#245C5A" }}>
                      {sopDetail.category}
                    </span>
                    {sopDetail.status === "review" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FFFBEB", color: "#B45309" }}>Under Review</span>}
                    {sopDetail.status === "current" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>Current</span>}
                  </div>
                  <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>{sopDetail.title}</h2>
                  <p className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{sopDetail.id}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>
                    <Tag size={12} />
                    <span>Category: <strong style={{ color: "var(--topbar-title)" }}>{sopDetail.category}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>
                    <CalendarIcon size={12} />
                    <span>Last Updated: <strong style={{ color: "var(--topbar-title)" }}>{new Date(sopDetail.updated).toLocaleDateString()}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    <Scale size={12} />
                    <span>Status: <strong style={{ color: sopDetail.status === "current" ? "#059669" : "#D97706" }}>{sopDetail.status === "current" ? "Current" : "Under Review"}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "policies" && (
        <div className="space-y-2">
          {refs.map((r) => (
            <div key={r.title} className="rounded-lg border p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <Scale size={16} style={{ color: "#7C3AED" }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{r.title}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{r.citation}</div>
              </div>
              <ExternalLink size={12} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
          ))}
          {refs.length === 0 && (
            <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <Scale size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No regulatory references found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "training" && (
        <div className="text-center py-12">
          <GraduationCap size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Training materials, competency assessments, and scenario-based learning modules</p>
        </div>
      )}
      </div>
    </PageLayout>
  );
}

function CalendarIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default SOPKnowledgePage;
