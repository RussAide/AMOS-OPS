import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search, Users, AlertTriangle, FileText, BookOpen, Pill,
  Wrench, DollarSign, ShieldCheck, Target, ChevronRight,
  X, Sparkles, Network, Filter, TrendingUp,
} from "lucide-react";

const TYPE_ICONS: Record<string, { icon: typeof Users; color: string; bg: string; label: string }> = {
  youth: { icon: Users, color: "#2563EB", bg: "#EFF6FF", label: "Youth" },
  incident: { icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2", label: "Incident" },
  chart_audit: { icon: ShieldCheck, color: "#7C3AED", bg: "#F5F3FF", label: "Audit" },
  treatment_plan: { icon: FileText, color: "#059669", bg: "#ECFDF5", label: "Treatment" },
  medication_order: { icon: Pill, color: "#0891B2", bg: "#CFFAFE", label: "Medication" },
  work_order: { icon: Wrench, color: "#D97706", bg: "#FFFBEB", label: "Work Order" },
  authorization: { icon: DollarSign, color: "#245C5A", bg: "#f0f6f6", label: "Auth" },
  document: { icon: FileText, color: "#64748B", bg: "#F1F5F9", label: "Document" },
  sop: { icon: BookOpen, color: "#059669", bg: "#ECFDF5", label: "SOP" },
  cap: { icon: Target, color: "#DC2626", bg: "#FEF2F2", label: "CAP" },
};

const MODULE_COLORS: Record<string, string> = {
  Clinical: "#2563EB", Compliance: "#DC2626", Residential: "#059669",
  GAD: "#D97706", Revenue: "#245C5A", HR: "#7C3AED",
};

export function NILSearchPage() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults, isLoading } = trpc.m29.search.useQuery(
    { query: activeQuery, filters: typeFilter.length > 0 ? { types: typeFilter } : undefined },
    { enabled: activeQuery.length > 0 }
  );

  const { data: entityDetail } = trpc.m29.getEntity.useQuery(
    { id: selectedEntity! },
    { enabled: !!selectedEntity }
  );

  const { data: relationships } = trpc.m29.getRelationships.useQuery(
    { entityId: selectedEntity! },
    { enabled: !!selectedEntity }
  );

  const { data: stats } = trpc.m29.stats.useQuery();

  const handleSearch = () => {
    if (query.trim()) setActiveQuery(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery("");
    setSelectedEntity(null);
    inputRef.current?.focus();
  };

  const toggleTypeFilter = (type: string) => {
    setTypeFilter(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  // All unique types from stats
  const availableTypes = stats ? Object.keys(stats.byType) : [];

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Network size={20} style={{ color: "#245C5A" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>NIL Knowledge Graph</h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Semantic search across all operational modules — find records by operational need, not folder memory
        </p>
      </div>

      {/* ─── Stats Bar ─────────────────────────────────── */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: "Entities", value: stats.totalEntities, icon: Network },
            { label: "Relationships", value: stats.totalRelationships, icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded" style={{ backgroundColor: "#f0f6f6", color: "#245C5A" }}>
              <s.icon size={12} /> <strong>{s.value}</strong> {s.label}
            </div>
          ))}
          {Object.entries(stats.byModule).map(([mod, count]) => (
            <div key={mod} className="text-[10px] px-2 py-1 rounded font-medium" style={{ backgroundColor: (MODULE_COLORS[mod] || "#64748b") + "15", color: MODULE_COLORS[mod] || "#64748b" }}>
              {mod}: {count}
            </div>
          ))}
        </div>
      )}

      {/* ─── Search Bar ────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} style={{ color: "#94a3b8" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, tag, type, or module... (e.g., 'Synthetic-Person-002', 'behavioral', 'incident')"
            className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-[13px]"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
          />
          {query && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: "#94a3b8" }} />
            </button>
          )}
        </div>
        <button onClick={handleSearch} className="px-4 py-2.5 rounded-lg text-[12px] font-medium text-white flex items-center gap-1.5" style={{ backgroundColor: "#245C5A" }}>
          <Sparkles size={14} /> Search
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-2.5 rounded-lg border text-[12px] font-medium flex items-center gap-1.5"
          style={{ borderColor: typeFilter.length > 0 ? "#245C5A" : "var(--card-border)", color: typeFilter.length > 0 ? "#245C5A" : "var(--topbar-subtitle)", backgroundColor: typeFilter.length > 0 ? "#f0f6f6" : "var(--card-bg)" }}
        >
          <Filter size={14} /> {typeFilter.length > 0 ? `${typeFilter.length}` : ""}
        </button>
      </div>

      {/* ─── Type Filters ──────────────────────────────── */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <span className="text-[11px] font-medium mr-2" style={{ color: "var(--topbar-subtitle)" }}>Filter by type:</span>
          {availableTypes.map(type => {
            const ti = TYPE_ICONS[type] || TYPE_ICONS.document;
            const isActive = typeFilter.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className="text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors capitalize flex items-center gap-1"
                style={{
                  backgroundColor: isActive ? ti.bg : "#fff",
                  borderColor: isActive ? ti.color : "#e2e8f0",
                  color: isActive ? ti.color : "#94a3b8",
                }}
              >
                <ti.icon size={10} /> {ti.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ════════ Search Results (left panel) ═════════ */}
        <div className="lg:col-span-3">
          {!activeQuery && (
            <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <Network size={40} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
              <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>NIL Semantic Search</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                Search across youth records, incidents, audits, treatment plans, medications, SOPs, and more.
                <br />Try: "Synthetic-Person-002", "behavioral", "medication", "CANS", "HVAC"
              </p>
            </div>
          )}

          {isLoading && activeQuery && (
            <div className="text-center py-12">
              <Sparkles size={24} style={{ color: "#cbd5e1" }} className="mx-auto mb-3 animate-pulse" />
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Searching knowledge graph...</p>
            </div>
          )}

          {searchResults && searchResults.length === 0 && activeQuery && (
            <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <Search size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No results for &ldquo;{activeQuery}&rdquo;</p>
            </div>
          )}

          {searchResults && searchResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{activeQuery}&rdquo;
                </span>
              </div>
              <div className="space-y-2">
                {searchResults.map((result) => {
                  const ti = TYPE_ICONS[result.type] || TYPE_ICONS.document;
                  const Icon = ti.icon;
                  const isSelected = selectedEntity === result.id;

                  return (
                    <button
                      key={result.id}
                      onClick={() => setSelectedEntity(result.id)}
                      className="w-full rounded-lg border p-3 text-left transition-all"
                      style={{
                        backgroundColor: isSelected ? "#f0f6f6" : "var(--card-bg)",
                        borderColor: isSelected ? "#245C5A" : "var(--card-border)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ti.bg }}>
                          <Icon size={16} style={{ color: ti.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>{result.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ backgroundColor: ti.bg, color: ti.color }}>{ti.label}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (MODULE_COLORS[result.module] || "#64748b") + "15", color: MODULE_COLORS[result.module] || "#64748b" }}>{result.module}</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{result.subtitle}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {result.tags?.map((tag: string) => (
                              <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Score</div>
                          <div className="text-[14px] font-bold" style={{ color: "#245C5A" }}>{result.score ?? "—"}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ════════ Detail Panel (right panel) ═════════ */}
        <div className="lg:col-span-2">
          {!selectedEntity && (
            <div className="rounded-lg border p-6 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <Network size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Select a result to see relationships and connected records</p>
            </div>
          )}

          {selectedEntity && entityDetail && (
            <div className="space-y-3">
              {/* Entity Detail Card */}
              <div className="rounded-lg border p-4" style={{ backgroundColor: "#f0f6f6", borderColor: "#245C5A" }}>
                {(() => {
                  const ti = TYPE_ICONS[entityDetail.type] || TYPE_ICONS.document;
                  const Icon = ti.icon;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ti.bg }}>
                          <Icon size={14} style={{ color: ti.color }} />
                        </div>
                        <div>
                          <div className="text-[9px] px-1.5 py-0.5 rounded font-medium inline-block capitalize" style={{ backgroundColor: ti.bg, color: ti.color }}>{ti.label}</div>
                        </div>
                      </div>
                      <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--topbar-title)" }}>{entityDetail.title}</h3>
                      <p className="text-[11px] mb-2" style={{ color: "var(--topbar-subtitle)" }}>{entityDetail.subtitle}</p>
                      <div className="flex flex-wrap gap-1">
                        {entityDetail.tags?.map((tag: string) => (
                          <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#e2e8f0", color: "#475569" }}>{tag}</span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Relationships */}
              {relationships && relationships.length > 0 && (
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <h4 className="text-[12px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                    <Network size={13} style={{ color: "#245C5A" }} /> Connected Records ({relationships.length})
                  </h4>
                  <div className="space-y-2">
                    {relationships.map((rel, i: number) => {
                      if (!rel.entity) return null;
                      const ti = TYPE_ICONS[rel.entity.type] || TYPE_ICONS.document;
                      const Icon = ti.icon;
                      return (
                        <div key={i} className="flex items-center gap-3 p-2 rounded border" style={{ backgroundColor: "#fff", borderColor: "var(--card-border)" }}>
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ti.bg }}>
                            <Icon size={13} style={{ color: ti.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{rel.entity.title}</div>
                            <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{rel.relationship.label} • {rel.entity.module}</div>
                          </div>
                          <ChevronRight size={12} style={{ color: "#cbd5e1" }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {relationships && relationships.length === 0 && (
                <div className="rounded-lg border p-4 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>No connected records found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NILSearchPage;
