import { useState, useEffect } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { Network, Search, RefreshCw, GitBranch, Zap, Users, FileText, Activity } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  patient: "#059669", person: "#2563EB", treatment_plan: "#7C3AED",
  session: "#D97706", form: "#245C5A", audit: "#DC2626",
  claim: "#0f3460", work_order: "#6B7280", agent: "#e9c46a",
};

const TYPE_ICONS: Record<string, typeof Network> = {
  patient: Users, person: Users, treatment_plan: FileText,
  session: Activity, form: FileText, audit: FileText,
  claim: FileText, work_order: FileText, agent: Users,
};

export function NILGraphPage() {
  const [query, setQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [indexed, setIndexed] = useState(false);

  const { data: stats } = trpc.nil.getStats.useQuery(undefined, { enabled: indexed });
  const { data: searchResults } = trpc.nil.searchEntities.useQuery(
    { query }, { enabled: query.length > 2 && indexed }
  );
  const { data: network } = trpc.nil.getEntityNetwork.useQuery(
    { entityId: selectedEntity ?? "" }, { enabled: !!selectedEntity }
  );
  const { data: recommendations } = trpc.nil.getRecommendations.useQuery(
    { entityId: selectedEntity ?? "" }, { enabled: !!selectedEntity }
  );

  const reindex = trpc.nil.reindex.useMutation({
    onSuccess: () => setIndexed(true),
  });

  useEffect(() => {
    // Auto-index on first visit
    if (!indexed) reindex.mutate();
  }, []);

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1a1a2e" }}>
              <Network size={20} style={{ color: "#e9c46a" }} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>NIL Knowledge Graph</h1>
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
                {indexed
                  ? `${stats?.totalEntities ?? 0} entities · ${stats?.totalRelationships ?? 0} relationships`
                  : "Indexing system data..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => reindex.mutate()}
            disabled={reindex.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium border disabled:opacity-50"
            style={{ borderColor: "var(--card-border)" }}
          >
            <RefreshCw size={14} className={reindex.isPending ? "animate-spin" : ""} />
            {reindex.isPending ? "Indexing..." : "Reindex"}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {stats.entityTypes.map((et: any) => (
              <div key={et.entity_type} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[et.entity_type] ?? "#6B7280" }} />
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>{et.entity_type}</span>
                </div>
                <p className="text-[18px] font-bold" style={{ color: TYPE_COLORS[et.entity_type] ?? "#6B7280" }}>{et.count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search + Entity List */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-4 rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)" }}>
                <Search size={14} style={{ color: "var(--topbar-subtitle)" }} />
                <input
                  type="text"
                  placeholder="Search entities..."
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--topbar-title)" }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {query.length > 2 && searchResults?.map((entity: any) => (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity.id)}
                    className="w-full text-left p-2 rounded-lg transition-all hover:bg-gray-50 flex items-center gap-2"
                    style={{ backgroundColor: selectedEntity === entity.id ? "#F0FDFA" : "transparent" }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[entity.entity_type] ?? "#6B7280" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{entity.display_name}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{entity.entity_type} · {entity.module}</p>
                    </div>
                  </button>
                ))}
                {query.length <= 2 && (
                  <p className="text-[12px] text-center py-4" style={{ color: "var(--topbar-subtitle)" }}>Type 3+ characters to search</p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {selectedEntity && recommendations && recommendations.length > 0 && (
              <div className="rounded-lg border p-4 mt-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                  <Zap size={14} style={{ color: "#e9c46a" }} /> Related
                </h3>
                <div className="space-y-2">
                  {recommendations.map((rec: any) => (
                    <button
                      key={rec.id}
                      onClick={() => setSelectedEntity(rec.id)}
                      className="w-full text-left p-2 rounded-lg transition-all hover:bg-gray-50 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[rec.entity_type] ?? "#6B7280" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{rec.display_name}</p>
                        <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{rec.shared_connections} shared connections</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Network Graph */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              {selectedEntity && network ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                        Network View
                      </h3>
                      <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {network.totalNodes} nodes · {network.totalEdges} edges · Depth 2
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedEntity(null)}
                      className="text-[12px] px-3 py-1 rounded border"
                      style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
                    >
                      Clear
                    </button>
                  </div>

                  {/* Center node */}
                  {network.nodes[0] && (
                    <div className="mb-4 p-4 rounded-lg border-2" style={{ borderColor: TYPE_COLORS[network.nodes[0].entity_type] ?? "#245C5A", backgroundColor: (TYPE_COLORS[network.nodes[0].entity_type] ?? "#245C5A") + "08" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (TYPE_COLORS[network.nodes[0].entity_type] ?? "#245C5A") + "15" }}>
                          <Network size={18} style={{ color: TYPE_COLORS[network.nodes[0].entity_type] ?? "#245C5A" }} />
                        </div>
                        <div>
                          <p className="text-[16px] font-semibold" style={{ color: "var(--topbar-title)" }}>{network.nodes[0].display_name}</p>
                          <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{network.nodes[0].entity_type} · {network.nodes[0].module} · {network.nodes[0].description}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Connected nodes */}
                  <div className="space-y-2">
                    {network.nodes.slice(1).map((node: any) => {
                      const rels = network.edges.filter((e: any) =>
                        e.from_entity_id === node.id || e.to_entity_id === node.id
                      );
                      return (
                        <div key={node.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (TYPE_COLORS[node.entity_type] ?? "#6B7280") + "10" }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[node.entity_type] ?? "#6B7280" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{node.display_name}</p>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: (TYPE_COLORS[node.entity_type] ?? "#6B7280") + "10", color: TYPE_COLORS[node.entity_type] ?? "#6B7280" }}>{node.entity_type}</span>
                            </div>
                            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{node.description}</p>
                            {rels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rels.map((rel: any, i: number) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                                    <GitBranch size={8} className="inline mr-0.5" />{rel.relation_type} ({rel.strength})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#F0FDFA" }}>
                    <Network size={28} style={{ color: "#245C5A" }} />
                  </div>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Knowledge Graph</p>
                  <p className="text-[13px] text-center max-w-sm" style={{ color: "var(--topbar-subtitle)" }}>
                    Search for an entity on the left, or click "Reindex" to build the graph from all module data.
                  </p>
                  {!indexed && reindex.isPending && (
                    <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: "#245C5A" }}>
                      <RefreshCw size={14} className="animate-spin" /> Building graph...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
