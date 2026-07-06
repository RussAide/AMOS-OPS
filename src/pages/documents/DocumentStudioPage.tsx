import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  FileText, Search, Filter, Plus, ChevronRight, Clock, CheckCircle, XCircle, Archive,
  Eye, Edit, Trash2, Send, Check, RotateCcw, Tag, User, Calendar, FileClock,
  BookOpen, ShieldCheck, TrendingUp, BarChart3, FolderOpen,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6", icon: FileText },
  "in-review": { label: "In Review", color: "#2563EB", bg: "#EFF6FF", icon: Eye },
  approved: { label: "Approved", color: "#059669", bg: "#ECFDF5", icon: CheckCircle },
  published: { label: "Published", color: "#245C5A", bg: "#245C5A15", icon: BookOpen },
  archived: { label: "Archived", color: "#92400E", bg: "#FEF3C7", icon: Archive },
  superseded: { label: "Superseded", color: "#DC2626", bg: "#FEE2E2", icon: XCircle },
};

const DEPT_COLORS: Record<string, string> = {
  HR: "#2563EB", Clinical: "#059669", GRO: "#D97706", QA: "#7C3AED",
  Revenue: "#0891B2", GAD: "#6B7280", Executive: "#1a1a2e", All: "#245C5A",
};

function formatFileSize(bytes: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DocumentStudioPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const { data: stats } = trpc.m2.stats.useQuery();
  const { data: categories } = trpc.m2.listCategories.useQuery();
  const { data: docList } = trpc.m2.list.useQuery({
    search: search || undefined,
    categoryId: categoryFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: docDetail } = trpc.m2.getById.useQuery(
    { id: selectedDoc ?? "" },
    { enabled: !!selectedDoc }
  );

  const documents = docList?.documents ?? [];

  const statCards = [
    { label: "Total Documents", value: stats?.total ?? 0, icon: FolderOpen, color: "#245C5A" },
    { label: "Draft", value: stats?.draft ?? 0, icon: FileText, color: "#6B7280" },
    { label: "In Review", value: stats?.inReview ?? 0, icon: Eye, color: "#2563EB" },
    { label: "Approved", value: stats?.approved ?? 0, icon: CheckCircle, color: "#059669" },
    { label: "Published", value: stats?.published ?? 0, icon: BookOpen, color: "#245C5A" },
    { label: "Archived", value: stats?.archived ?? 0, icon: Archive, color: "#92400E" },
  ];

  return (
    
      <>
        <div className="px-4 md:px-6 pt-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-bold" style={{ color: "var(--topbar-title)" }}>Document Studio</h1>
            <p className="text-[14px]" style={{ color: "var(--topbar-subtitle)" }}>AMOS-Scribe — Document Management System</p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Plus size={16} /> New Document
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                style={{ borderColor: statusFilter === s.label.toLowerCase().replace(" ", "-") ? s.color : "var(--card-border)", backgroundColor: "var(--card-bg)" }}
                onClick={() => setStatusFilter(statusFilter === s.label.toLowerCase().replace(" ", "-") ? "" : s.label.toLowerCase().replace(" ", "-"))}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} style={{ color: s.color }} />
                  <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</span>
                </div>
                <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
            <input
              type="text"
              placeholder="Search documents by title, ID, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-[13px] outline-none focus:ring-2"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)", focusRing: "#245C5A30" }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border text-[13px] outline-none"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
          >
            <option value="">All Categories</option>
            {(categories ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border text-[13px] outline-none"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Document List + Detail Split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Document List */}
          <div className="lg:col-span-3 space-y-2">
            {documents.length === 0 ? (
              <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <FolderOpen size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No documents found</p>
              </div>
            ) : (
              documents.map((doc: any) => {
                const st = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft;
                const StatusIcon = st.icon;
                return (
                  <div
                    key={doc.id}
                    className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                    style={{
                      borderColor: selectedDoc === doc.id ? "#245C5A" : "var(--card-border)",
                      backgroundColor: selectedDoc === doc.id ? "#245C5A08" : "var(--card-bg)",
                    }}
                    onClick={() => setSelectedDoc(doc.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                        <StatusIcon size={16} style={{ color: st.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--topbar-title)" }}>{doc.title}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ backgroundColor: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-[11px] truncate mb-1" style={{ color: "var(--topbar-subtitle)" }}>{doc.documentId}</p>
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                          <span className="flex items-center gap-1">
                            <FolderOpen size={10} /> {doc.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={10} /> {doc.authorName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(doc.createdAt)}
                          </span>
                          {doc.fileName && (
                            <span className="flex items-center gap-1">
                              <FileText size={10} /> {formatFileSize(doc.fileSize)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className="flex-shrink-0 mt-2" style={{ color: "var(--topbar-subtitle)" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Document Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedDoc || !docDetail ? (
              <div className="rounded-lg border p-6 text-center sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <FileText size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>Select a document</p>
                <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Click a document to view details and manage its lifecycle.</p>
              </div>
            ) : (
              <div className="rounded-lg border sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                {/* Detail Header */}
                <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const st = STATUS_CONFIG[docDetail.status] ?? STATUS_CONFIG.draft;
                      const StatusIcon = st.icon;
                      return (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: st.bg, color: st.color }}>
                          <StatusIcon size={10} /> {st.label}
                        </span>
                      );
                    })()}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (DEPT_COLORS[docDetail.department] ?? "#6B7280") + "15", color: DEPT_COLORS[docDetail.department] ?? "#6B7280" }}>
                      {docDetail.department}
                    </span>
                  </div>
                  <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>{docDetail.title}</h2>
                  <p className="text-[11px] font-mono mb-2" style={{ color: "var(--topbar-subtitle)" }}>{docDetail.documentId}</p>
                  <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{docDetail.description}</p>
                </div>

                {/* Metadata */}
                <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Metadata</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>Category</span>
                      <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{docDetail.category}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>Author</span>
                      <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{docDetail.authorName}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>Version</span>
                      <span className="font-medium" style={{ color: "var(--topbar-title)" }}>v{docDetail.version}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>File</span>
                      <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{docDetail.fileName ?? "-"} {docDetail.fileSize ? `(${formatFileSize(docDetail.fileSize)})` : ""}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: "var(--topbar-subtitle)" }}>Retention</span>
                      <span className="font-medium" style={{ color: "var(--topbar-title)" }}>{docDetail.retentionYears} years</span>
                    </div>
                    {docDetail.expiryDate && (
                      <div className="flex justify-between text-[12px]">
                        <span style={{ color: "var(--topbar-subtitle)" }}>Expires</span>
                        <span className="font-medium" style={{ color: "#D97706" }}>{formatDate(docDetail.expiryDate)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {(() => {
                    try {
                      const tags = JSON.parse(docDetail.tagsJson ?? "[]");
                      if (tags.length === 0) return null;
                      return (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tags.map((t: string) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#245C5A12", color: "#245C5A" }}>
                              <Tag size={8} className="inline mr-1" />{t}
                            </span>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>

                {/* Lifecycle Timeline */}
                <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Lifecycle</h3>
                  <div className="space-y-2">
                    {docDetail.createdAt && (
                      <div className="flex items-center gap-2">
                        <FileText size={12} style={{ color: "#6B7280" }} />
                        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Created {formatDate(docDetail.createdAt)} by {docDetail.authorName}</span>
                      </div>
                    )}
                    {docDetail.reviewedAt && (
                      <div className="flex items-center gap-2">
                        <Eye size={12} style={{ color: "#2563EB" }} />
                        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Reviewed {formatDate(docDetail.reviewedAt)} by {docDetail.reviewedBy}</span>
                      </div>
                    )}
                    {docDetail.approvedAt && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} style={{ color: "#059669" }} />
                        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Approved {formatDate(docDetail.approvedAt)} by {docDetail.approvedBy}</span>
                      </div>
                    )}
                    {docDetail.publishedAt && (
                      <div className="flex items-center gap-2">
                        <BookOpen size={12} style={{ color: "#245C5A" }} />
                        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Published {formatDate(docDetail.publishedAt)} by {docDetail.publishedBy}</span>
                      </div>
                    )}
                    {docDetail.archivedAt && (
                      <div className="flex items-center gap-2">
                        <Archive size={12} style={{ color: "#92400E" }} />
                        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Archived {formatDate(docDetail.archivedAt)} by {docDetail.archivedBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Versions */}
                {docDetail.versions && docDetail.versions.length > 0 && (
                  <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Versions ({docDetail.versions.length})</h3>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {docDetail.versions.map((v: any) => (
                        <div key={v.id} className="flex items-center gap-2 text-[11px]">
                          <span className="font-mono font-medium" style={{ color: v.versionNumber === docDetail.version ? "#245C5A" : "var(--topbar-subtitle)" }}>v{v.versionNumber}</span>
                          <span className="flex-1 truncate" style={{ color: "var(--topbar-title)" }}>{v.changeSummary}</span>
                          <span style={{ color: "var(--topbar-subtitle)" }}>{formatDate(v.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                {docDetail.audit && docDetail.audit.length > 0 && (
                  <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Audit Trail</h3>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {docDetail.audit.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-2 text-[11px]">
                          <span className="capitalize font-medium" style={{ color: a.action === "status-changed" ? "#2563EB" : a.action === "created" ? "#059669" : "var(--topbar-title)" }}>{a.action}</span>
                          <span className="flex-1 truncate" style={{ color: "var(--topbar-subtitle)" }}>{a.details}</span>
                          <span style={{ color: "var(--topbar-subtitle)" }}>{formatDate(a.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {docDetail.status === "draft" && (
                      <>
                        <ActionButton icon={Send} label="Submit for Review" color="#2563EB" />
                        <ActionButton icon={Edit} label="Edit" color="#6B7280" />
                      </>
                    )}
                    {docDetail.status === "in-review" && (
                      <>
                        <ActionButton icon={Check} label="Approve" color="#059669" />
                        <ActionButton icon={RotateCcw} label="Return to Draft" color="#6B7280" />
                      </>
                    )}
                    {docDetail.status === "approved" && (
                      <>
                        <ActionButton icon={BookOpen} label="Publish" color="#245C5A" />
                        <ActionButton icon={RotateCcw} label="Return to Draft" color="#6B7280" />
                      </>
                    )}
                    {docDetail.status === "published" && (
                      <>
                        <ActionButton icon={Archive} label="Archive" color="#92400E" />
                      </>
                    )}
                    {docDetail.status === "archived" && (
                      <>
                        <ActionButton icon={RotateCcw} label="Restore to Draft" color="#6B7280" />
                      </>
                    )}
                    <ActionButton icon={Trash2} label="Delete" color="#DC2626" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  </>
  );
}

function ActionButton({ icon: Icon, label, color }: { icon: typeof Edit; label: string; color: string }) {
  return (
    <>

      <button
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80 border"
      style={{ borderColor: color + "40", color, backgroundColor: color + "08" }}
    >
      <Icon size={12} /> {label}
    </button>
    </>
  );
}

export default DocumentStudioPage;
