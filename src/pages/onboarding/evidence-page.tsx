import { useState } from "react";
import { FileCheck, Upload, CheckCircle, XCircle, Filter } from "lucide-react";
import { useOnboarding } from "@/context/onboarding-context";
import { evidenceStatusColors } from "@/data/onboardingData";
import { FileUpload, FileDownloadButton } from "@/components/onboarding/file-upload";

type FilterStatus = "all" | "pending" | "reviewing" | "approved" | "rejected";

export function EvidencePage() {
  const { evidence, submitEvidence, reviewEvidence, modules } = useOnboarding();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    moduleTitle: modules[0]?.title || "",
  });
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    type: string;
    content: string;
  } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const filtered = filter === "all" ? evidence : evidence.filter((e) => e.status === filter);

  const statusCounts = {
    all: evidence.length,
    pending: evidence.filter((e) => e.status === "pending").length,
    reviewing: evidence.filter((e) => e.status === "reviewing").length,
    approved: evidence.filter((e) => e.status === "approved").length,
    rejected: evidence.filter((e) => e.status === "rejected").length,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title || !uploadForm.moduleTitle || !uploadedFile) return;
    submitEvidence({
      title: uploadForm.title,
      moduleTitle: uploadForm.moduleTitle,
      status: "pending",
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileContent: uploadedFile.content,
      fileType: uploadedFile.type,
    });
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadSuccess(false);
      setShowUpload(false);
      setUploadForm({ title: "", moduleTitle: modules[0]?.title || "" });
      setUploadedFile(null);
    }, 1500);
  };

  const handleCancel = () => {
    setShowUpload(false);
    setUploadForm({ title: "", moduleTitle: modules[0]?.title || "" });
    setUploadedFile(null);
    setUploadSuccess(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFBEB" }}>
            <FileCheck size={20} style={{ color: "#D97706" }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Evidence Review
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Manage training evidence and certification uploads
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:shadow-md"
          style={{ backgroundColor: "#245C5A" }}
        >
          <Upload size={15} />
          Submit Evidence
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
        >
          <h3 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>
            Submit New Evidence
          </h3>
          {uploadSuccess ? (
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "#ECFDF5" }}>
              <CheckCircle size={20} style={{ color: "#059669" }} />
              <p className="text-[14px] font-medium" style={{ color: "#065F46" }}>
                Evidence submitted successfully!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--topbar-title)" }}>
                  Evidence Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g., HIPAA Certification"
                  className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:ring-2"
                  style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--topbar-title)" }}>
                  Related Module *
                </label>
                <select
                  value={uploadForm.moduleTitle}
                  onChange={(e) => setUploadForm({ ...uploadForm, moduleTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:ring-2"
                  style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.title}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--topbar-title)" }}>
                  Supporting Document *
                </label>
                <FileUpload
                  onFileSelect={setUploadedFile}
                  onClear={() => setUploadedFile(null)}
                  value={uploadedFile}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!uploadedFile || !uploadForm.title}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  Submit Evidence
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium border"
                  style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        <Filter size={14} className="mr-2 flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }} />
        {(["all", "pending", "reviewing", "approved", "rejected"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all flex-shrink-0"
            style={{
              backgroundColor: filter === s ? "#245C5A" : "transparent",
              color: filter === s ? "#fff" : "var(--topbar-subtitle)",
            }}
          >
            {s} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* Evidence List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck size={40} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>
              No evidence found
            </p>
            <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
              {filter === "all" ? "Submit your first evidence to get started." : "No items match the selected filter."}
            </p>
          </div>
        ) : (
          filtered.map((ev) => {
            const colors = evidenceStatusColors[ev.status];
            return (
              <div
                key={ev.id}
                className="rounded-lg border p-4 transition-all hover:shadow-sm"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {colors.label}
                      </span>
                    </div>
                    <h4 className="text-[14px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>
                      {ev.title}
                    </h4>
                    <p className="text-[12px] mb-2" style={{ color: "var(--topbar-subtitle)" }}>
                      Module: {ev.moduleTitle} • {ev.fileName} ({ev.fileSize})
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        Submitted: {ev.submittedAt}
                      </p>
                      {ev.fileContent && (
                        <FileDownloadButton
                          fileName={ev.fileName}
                          fileContent={ev.fileContent}
                          fileSize={ev.fileSize}
                        />
                      )}
                    </div>
                  </div>

                  {/* Review Actions */}
                  {(ev.status === "pending" || ev.status === "reviewing") && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => reviewEvidence(ev.id, "approved")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all hover:shadow-sm"
                        style={{ backgroundColor: "#059669" }}
                      >
                        <CheckCircle size={13} />
                        Approve
                      </button>
                      <button
                        onClick={() => reviewEvidence(ev.id, "rejected")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all hover:shadow-sm"
                        style={{ backgroundColor: "#DC2626" }}
                      >
                        <XCircle size={13} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EvidencePage;
