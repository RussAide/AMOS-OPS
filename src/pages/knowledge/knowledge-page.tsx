import { useState, useMemo } from "react";
import { PageLayout } from "@/components/shell/page-layout";
import { trpc } from "@/providers/trpc";
import {
  BookOpen, Search, FileText, Clock, CheckCircle, AlertTriangle,
  Archive, Filter, ChevronRight, ExternalLink, Eye, Layers,
  Stethoscope, Users, ShieldCheck, Building2, HardHat, ClipboardList,
  TrendingUp, BarChart3, X,
} from "lucide-react";

/* ─── Types ─── */
type DocumentStatus = "published" | "draft" | "in-review" | "archived";
type SOPCategory = "Clinical" | "HR" | "Compliance" | "GRO" | "GAD" | "Safety" | "Administration";

interface SOPDocument {
  id: string;
  documentId: string;
  title: string;
  description: string;
  category: SOPCategory;
  version: string;
  status: DocumentStatus;
  author: string;
  updatedAt: string;
  effectiveDate: string;
  reviewDate: string;
  icon: React.ElementType;
}

/* ─── Category Config ─── */
const CATEGORY_CONFIG: Record<SOPCategory, { color: string; icon: React.ElementType; description: string }> = {
  Clinical:      { color: "#2563EB", icon: Stethoscope,    description: "Clinical protocols and treatment procedures" },
  HR:            { color: "#245C5A", icon: Users,          description: "Human resources policies and procedures" },
  Compliance:    { color: "#D97706", icon: ShieldCheck,    description: "Regulatory compliance and quality assurance" },
  GRO:           { color: "#0891B2", icon: Building2,      description: "Residential operations and youth care" },
  GAD:           { color: "#7C3AED", icon: ClipboardList,  description: "General administration documentation" },
  Safety:        { color: "#DC2626", icon: HardHat,        description: "Safety protocols and emergency procedures" },
  Administration:{ color: "#059669", icon: FileText,       description: "Administrative procedures and forms" },
};

const STATUS_CONFIG: Record<DocumentStatus, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  published: { bg: "#ECFDF5", color: "#059669", label: "Published",  icon: CheckCircle },
  draft:     { bg: "#F3F4F6", color: "#6B7280", label: "Draft",      icon: FileText },
  "in-review": { bg: "#FFFBEB", color: "#D97706", label: "Under Review", icon: AlertTriangle },
  archived:  { bg: "#FEF2F2", color: "#DC2626", label: "Archived",   icon: Archive },
};

/* ─── Demo SOP Data ─── */
const DEMO_SOPS: SOPDocument[] = [
  {
    id: "sop-001", documentId: "ADL-CLN-PRO-001",
    title: "Crisis Intervention Protocol",
    description: "Step-by-step procedures for de-escalating behavioral crises, including physical restraint guidelines and post-incident documentation requirements.",
    category: "Clinical", version: "4.2", status: "published",
    author: "Dr. Hall", updatedAt: "2026-06-28", effectiveDate: "2026-07-01", reviewDate: "2027-01-01",
    icon: Stethoscope,
  },
  {
    id: "sop-002", documentId: "ADL-HR-POL-001",
    title: "Employee Code of Conduct",
    description: "Comprehensive ethical guidelines covering professional boundaries, confidentiality, social media policy, and reporting obligations for all staff.",
    category: "HR", version: "3.1", status: "published",
    author: "E. Russ Aideyan", updatedAt: "2026-06-25", effectiveDate: "2026-01-01", reviewDate: "2026-12-31",
    icon: Users,
  },
  {
    id: "sop-003", documentId: "ADL-CMP-QA-001",
    title: "HIPAA Privacy & Security Compliance",
    description: "Guidelines for handling protected health information (PHI), including access controls, breach notification procedures, and staff training requirements.",
    category: "Compliance", version: "5.0", status: "published",
    author: "E. Russ Aideyan", updatedAt: "2026-06-20", effectiveDate: "2026-06-20", reviewDate: "2027-06-20",
    icon: ShieldCheck,
  },
  {
    id: "sop-004", documentId: "ADL-GRO-OPS-001",
    title: "Youth Admission & Intake Procedures",
    description: "Standard procedures for admitting new residents including intake assessments, orientation, room assignment, and initial care planning.",
    category: "GRO", version: "2.3", status: "in-review",
    author: "Lilian Ike", updatedAt: "2026-06-15", effectiveDate: "2026-07-15", reviewDate: "2027-01-15",
    icon: Building2,
  },
  {
    id: "sop-005", documentId: "ADL-GAD-ADM-001",
    title: "Facility Maintenance & Work Orders",
    description: "Procedures for submitting, tracking, and completing facility maintenance requests including emergency repair protocols and vendor management.",
    category: "GAD", version: "1.8", status: "published",
    author: "GRO Admin", updatedAt: "2026-06-10", effectiveDate: "2026-05-01", reviewDate: "2027-05-01",
    icon: ClipboardList,
  },
  {
    id: "sop-006", documentId: "ADL-SFT-EMR-001",
    title: "Emergency Evacuation & Fire Safety",
    description: "Emergency response procedures including evacuation routes, accountability protocols, fire drill schedules, and staff role assignments during emergencies.",
    category: "Safety", version: "3.5", status: "published",
    author: "RCS Lead", updatedAt: "2026-06-22", effectiveDate: "2026-06-01", reviewDate: "2027-06-01",
    icon: HardHat,
  },
  {
    id: "sop-007", documentId: "ADL-ADM-FRM-001",
    title: "Incident Report Documentation",
    description: "Standardized procedures for documenting and reporting incidents involving youth, staff, or facility issues including timelines and escalation requirements.",
    category: "Administration", version: "2.0", status: "published",
    author: "Lilian Ike", updatedAt: "2026-06-18", effectiveDate: "2026-07-01", reviewDate: "2027-07-01",
    icon: FileText,
  },
  {
    id: "sop-008", documentId: "ADL-CLN-MED-001",
    title: "Medication Administration & Documentation",
    description: "Protocols for administering, documenting, and monitoring medications including PRN medications, refusal procedures, and medication error reporting.",
    category: "Clinical", version: "6.1", status: "published",
    author: "Dr. Sarah Kim", updatedAt: "2026-06-29", effectiveDate: "2026-06-15", reviewDate: "2026-12-15",
    icon: Stethoscope,
  },
];

/* ─── Main Component ─── */
export function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch document stats from tRPC
  const { data: docStats } = trpc.m2.stats.useQuery();
  const stats = docStats ?? { total: 12, published: 4, draft: 3, inReview: 2, approved: 2, archived: 1 };

  // Filter SOPs
  const filtered = useMemo(() => {
    let data = [...DEMO_SOPS];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.documentId.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      data = data.filter((s) => s.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      data = data.filter((s) => s.status === statusFilter);
    }

    return data;
  }, [search, categoryFilter, statusFilter]);

  const categories: string[] = ["all", ...Array.from(new Set(DEMO_SOPS.map((s) => s.category)))];
  const statuses = ["all", "published", "in-review", "draft", "archived"];

  // KPI calculations
  const totalSOPs = DEMO_SOPS.length;
  const publishedCount = DEMO_SOPS.filter((s) => s.status === "published").length;
  const underReviewCount = DEMO_SOPS.filter((s) => s.status === "in-review").length;
  const archivedCount = DEMO_SOPS.filter((s) => s.status === "archived").length;

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <BookOpen size={22} style={{ color: "#245C5A" }} />
            Knowledge & SOP Library
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Standard operating procedures, policy documents, and organizational knowledge
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total SOPs", value: totalSOPs, color: "#245C5A", bg: "#F0FDFA", icon: BookOpen },
            { label: "Published", value: publishedCount, color: "#059669", bg: "#ECFDF5", icon: CheckCircle },
            { label: "Under Review", value: underReviewCount, color: "#D97706", bg: "#FFFBEB", icon: AlertTriangle },
            { label: "Archived", value: archivedCount, color: "#DC2626", bg: "#FEF2F2", icon: Archive },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                    <Icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
            <input
              placeholder="Search SOPs by title, ID, description, or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-[12px] rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={12} style={{ color: "var(--topbar-subtitle)" }} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-[11px] px-2 py-2 rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(DEMO_SOPS.map((s) => s.category))).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] px-2 py-2 rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="in-review">Under Review</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Category Sidebar + Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Category Sidebar */}
          <div className="lg:col-span-1">
            <div
              className="rounded-lg border p-3 sticky top-4"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--topbar-subtitle)" }}>
                Categories
              </h3>
              <div className="space-y-0.5">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left border-none transition-colors text-[11px]"
                  style={{
                    backgroundColor: categoryFilter === "all" ? ("rgba(36,92,90,0.08)") : "transparent",
                    color: categoryFilter === "all" ? "#245C5A" : "var(--topbar-title)",
                    cursor: "pointer",
                    fontWeight: categoryFilter === "all" ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (categoryFilter !== "all") e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"; }}
                  onMouseLeave={(e) => { if (categoryFilter !== "all") e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <Layers size={13} />
                  <span className="flex-1">All Categories</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--card-bg)", color: "var(--topbar-subtitle)" }}>
                    {DEMO_SOPS.length}
                  </span>
                </button>
                {(Object.keys(CATEGORY_CONFIG) as SOPCategory[]).map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const count = DEMO_SOPS.filter((s) => s.category === cat).length;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left border-none transition-colors text-[11px]"
                      style={{
                        backgroundColor: categoryFilter === cat ? (cfg.color + "10") : "transparent",
                        color: categoryFilter === cat ? cfg.color : "var(--topbar-title)",
                        cursor: "pointer",
                        fontWeight: categoryFilter === cat ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { if (categoryFilter !== cat) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"; }}
                      onMouseLeave={(e) => { if (categoryFilter !== cat) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <Icon size={13} />
                      <span className="flex-1">{cat}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: categoryFilter === cat ? cfg.color + "15" : "transparent", color: categoryFilter === cat ? cfg.color : "var(--topbar-subtitle)" }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status summary */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--topbar-subtitle)" }}>
                  By Status
                </h3>
                <div className="space-y-1.5">
                  {(Object.entries(STATUS_CONFIG) as [DocumentStatus, typeof STATUS_CONFIG[DocumentStatus]][]).map(([status, cfg]) => {
                    const count = DEMO_SOPS.filter((s) => s.status === status).length;
                    const pct = Math.round((count / totalSOPs) * 100);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{cfg.label}</span>
                          <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-border)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Document Cards */}
          <div className="lg:col-span-3">
            {filtered.length === 0 ? (
              <div className="rounded-lg border p-12 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <BookOpen size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No SOPs match your search</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((sop) => {
                  const catCfg = CATEGORY_CONFIG[sop.category];
                  const stCfg = STATUS_CONFIG[sop.status];
                  const StatusIcon = stCfg.icon;
                  const CatIcon = sop.icon;
                  const isExpanded = expandedDoc === sop.id;

                  return (
                    <div
                      key={sop.id}
                      className="rounded-lg border overflow-hidden transition-all"
                      style={{
                        borderColor: isExpanded ? catCfg.color : "var(--card-border)",
                        backgroundColor: "var(--card-bg)",
                      }}
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedDoc(isExpanded ? null : sop.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: catCfg.color + "12" }}
                          >
                            <CatIcon size={18} style={{ color: catCfg.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                                {sop.title}
                              </h3>
                              <span
                                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
                              >
                                <StatusIcon size={8} /> {stCfg.label}
                              </span>
                            </div>
                            <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--topbar-subtitle)" }}>
                              {sop.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: catCfg.color + "10", color: catCfg.color }}
                              >
                                {sop.category}
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{sop.documentId}</span>
                              <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--topbar-subtitle)" }}>
                                <FileText size={10} /> v{sop.version}
                              </span>
                              <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--topbar-subtitle)" }}>
                                <Clock size={10} /> Updated {sop.updatedAt}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="p-1.5 rounded-md border-none cursor-pointer transition-opacity hover:opacity-70"
                              style={{ backgroundColor: "transparent" }}
                              title="View document"
                            >
                              <Eye size={14} style={{ color: "var(--topbar-subtitle)" }} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="p-1.5 rounded-md border-none cursor-pointer transition-opacity hover:opacity-70"
                              style={{ backgroundColor: "transparent" }}
                              title="Open in new tab"
                            >
                              <ExternalLink size={14} style={{ color: "var(--topbar-subtitle)" }} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--card-border)", backgroundColor: "rgba(36,92,90,0.015)" }}>
                          <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Full Description</p>
                              <p className="text-[11px] leading-relaxed" style={{ color: "var(--topbar-title)" }}>{sop.description}</p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Author</p>
                                <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{sop.author}</p>
                              </div>
                              <div>
                                <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Effective Date</p>
                                <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{sop.effectiveDate}</p>
                              </div>
                              <div>
                                <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Next Review</p>
                                <p className="text-[11px] font-medium" style={{ color: sop.reviewDate < "2026-12-31" ? "#D97706" : "var(--topbar-title)" }}>{sop.reviewDate}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Version History</p>
                                <div className="space-y-1 mt-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#059669" }} />
                                    <span className="text-[10px]" style={{ color: "var(--topbar-title)" }}>v{sop.version} — Current</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#9CA3AF" }} />
                                    <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>v{parseFloat(sop.version) - 0.1} — Previous</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#9CA3AF" }} />
                                    <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>v{parseFloat(sop.version) - 0.2} — Superseded</span>
                                  </div>
                                </div>
                              </div>
                              <div className="pt-2 flex gap-2">
                                <button
                                  className="text-[10px] px-3 py-1.5 rounded-md font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}
                                >
                                  <Eye size={10} className="inline mr-1" /> View Full Document
                                </button>
                                <button
                                  className="text-[10px] px-3 py-1.5 rounded-md font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                                >
                                  <FileText size={10} className="inline mr-1" /> Download PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default KnowledgePage;
