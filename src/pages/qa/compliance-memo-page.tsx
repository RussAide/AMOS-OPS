import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Search, CheckCircle, Lock, Eye, PenLine,
} from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F3F4F6", color: "#6B7280" },
  pending_review: { bg: "#FEF3C7", color: "#D97706" },
  approved: { bg: "#D1FAE5", color: "#059669" },
  issued: { bg: "#DBEAFE", color: "#2563EB" },
  acknowledged: { bg: "#ECFDF5", color: "#059669" },
  superseded: { bg: "#F3E8FF", color: "#7C3AED" },
};

const PRIORITY_COLORS: Record<string, string> = {
  routine: "#2563EB",
  urgent: "#D97706",
  emergency: "#DC2626",
};

const CLASSIFICATION_ICONS: Record<string, typeof Eye> = {
  internal: Eye,
  restricted: Lock,
  confidential: Lock,
};

function formatMemoRecipients(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;

    const names: string[] = [];
    for (const item of parsed) {
      if (typeof item === "object" && item !== null && "name" in item && typeof item.name === "string") {
        names.push(item.name);
      }
    }
    return names.length > 0 ? names.join(", ") : value;
  } catch {
    return value;
  }
}

export function ComplianceMemoPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "approved" | "superseded" | "acknowledged" | "pending_review" | "issued">("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formPriority, setFormPriority] = useState<"routine" | "urgent" | "emergency">("routine");
  const [formClassification, setFormClassification] = useState<"internal" | "restricted" | "confidential">("internal");

  const { data: memos, refetch } = trpc.m3.memoList.useQuery({
    status: statusFilter || undefined,
    search: search || undefined,
  });
  const { data: stats } = trpc.m3.memoStats.useQuery();
  const createMemo = trpc.m3.memoCreate.useMutation({ onSuccess: () => { refetch(); setShowCreateForm(false); resetForm(); } });
  const updateMemo = trpc.m3.memoUpdate.useMutation({ onSuccess: () => refetch() });

  const resetForm = () => {
    setFormTitle(""); setFormSubject(""); setFormBody(""); setFormTo("");
    setFormPriority("routine"); setFormClassification("internal");
  };

  const handleSubmit = () => {
    if (!formTitle || !formSubject || !formBody || !formTo) return;
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 999).toString().padStart(3, "0");
    createMemo.mutate({
      memoNumber: `MEMO-${year}-${seq}`,
      title: formTitle,
      subject: formSubject,
      body: formBody,
      toRecipients: JSON.stringify([{ name: formTo, role: "recipient" }]),
      fromName: "QA Officer",
      fromId: "system",
      fromTitle: "Quality Assurance",
      memoDate: now.split("T")[0],
      priority: formPriority,
      classification: formClassification,
    });
  };

  const handleStatusAdvance = (id: string, currentStatus: string) => {
    const flow: Record<string, string> = {
      draft: "pending_review",
      pending_review: "approved",
      approved: "issued",
    };
    const next = flow[currentStatus];
    if (next) updateMemo.mutate({ id, status: next as Parameters<typeof updateMemo.mutate>[0]["status"] });
  };

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate("/qa")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Back to QA Dashboard
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <FileText size={22} style={{ color: "#2563EB" }} /> Compliance Memo Generator
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: "#2563EB" }}
          >
            <PenLine size={16} /> {showCreateForm ? "Cancel" : "New Memo"}
          </button>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Generate, review, and issue compliance memoranda with full audit trail
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "#6B7280" },
          { label: "Draft", value: stats?.draft ?? 0, color: "#6B7280" },
          { label: "Pending", value: stats?.pending ?? 0, color: "#D97706" },
          { label: "Approved", value: stats?.approved ?? 0, color: "#059669" },
          { label: "Issued", value: stats?.issued ?? 0, color: "#2563EB" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>New Compliance Memo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text" placeholder="Title" value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            />
            <input
              type="text" placeholder="Subject" value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              className="rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            />
            <input
              type="text" placeholder="To (recipient name)" value={formTo}
              onChange={(e) => setFormTo(e.target.value)}
              className="rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            />
            <div className="flex gap-2">
              <select
                value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as typeof formPriority)}
                className="rounded-lg border px-3 py-2 text-[13px] outline-none flex-1"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
              <select
                value={formClassification}
                  onChange={(e) => setFormClassification(e.target.value as typeof formClassification)}
                className="rounded-lg border px-3 py-2 text-[13px] outline-none flex-1"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
              >
                <option value="internal">Internal</option>
                <option value="restricted">Restricted</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>
          </div>
          <textarea
            placeholder="Memo body..."
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            rows={4}
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none mb-3"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!formTitle || !formSubject || !formBody || !formTo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#059669" }}
            >
              <CheckCircle size={16} /> Create Memo
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 min-w-[200px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={14} style={{ color: "var(--topbar-subtitle)" }} />
          <input
            type="text"
            placeholder="Search memos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[13px] outline-none flex-1"
            style={{ color: "var(--topbar-title)" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="issued">Issued</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
      </div>

      {/* Memo List */}
      <div className="space-y-3">
        {(!memos || memos.length === 0) && (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No compliance memos found</p>
        )}
        {memos?.map((memo) => {
          const sc = STATUS_COLORS[memo.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
          const ClassIcon = CLASSIFICATION_ICONS[memo.classification] ?? Eye;
          return (
            <div key={memo.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{memo.memoNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                    {memo.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (PRIORITY_COLORS[memo.priority] ?? "#6B7280") + "15", color: PRIORITY_COLORS[memo.priority] ?? "#6B7280" }}>
                    {memo.priority}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                    <ClassIcon size={10} /> {memo.classification}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{memo.memoDate}</span>
              </div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{memo.title}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>Subject: {memo.subject}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--topbar-title)" }}>{memo.body}</p>

              {/* Action Bar */}
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--card-border)" }}>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  To: {formatMemoRecipients(memo.toRecipients)}
                </span>
                <div className="flex-1" />
                {memo.status === "draft" && (
                  <button onClick={() => handleStatusAdvance(memo.id, memo.status)} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
                    Submit for Review
                  </button>
                )}
                {memo.status === "pending_review" && (
                  <button onClick={() => handleStatusAdvance(memo.id, memo.status)} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                    Approve
                  </button>
                )}
                {memo.status === "approved" && (
                  <button onClick={() => handleStatusAdvance(memo.id, memo.status)} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }}>
                    Issue Memo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ComplianceMemoPage;
