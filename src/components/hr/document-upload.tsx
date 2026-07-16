import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useHR } from "@/context/hr-context";
import { trpc } from "@/providers/trpc";

interface Props {
  personId: string;
  moduleId: string;
  recordName: string;
  onUploaded?: () => void;
  uploadedBy?: string;
}

export function DocumentUpload({ personId, moduleId, recordName, onUploaded, uploadedBy = "Current User" }: Props) {
  const { addDocument } = useHR();
  const utils = trpc.useUtils();
  const [isDragging, setIsDragging] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");

      try {
        // Step 1: Upload file to /api/upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("personId", personId);
        formData.append("moduleId", moduleId);
        formData.append("recordName", recordName);
        formData.append("uploadedBy", uploadedBy);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed: ${response.status}`);
        }

        const uploadResult = await response.json();

        // Step 2: Create document record in database
        addDocument({
          personId,
          moduleId,
          recordName,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: uploadResult.filePath,
          uploadedBy,
          status: "uploaded",
        });

        // Invalidate queries
        utils.hr.listPeople.invalidate();

        setUploaded(true);
        setTimeout(() => {
          setUploaded(false);
          onUploaded?.();
        }, 1500);
      } catch (err) {
        console.error("[Upload] Error:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
        setTimeout(() => setError(""), 3000);
      } finally {
        setUploading(false);
      }
    },
    [personId, moduleId, recordName, uploadedBy, addDocument, utils, onUploaded]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  if (uploaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#ECFDF5" }}>
        <CheckCircle size={14} style={{ color: "#059669" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#065F46" }}>Uploaded</span>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#EFF6FF" }}>
        <Loader2 size={14} className="animate-spin" style={{ color: "#2563EB" }} />
        <span className="text-[11px] font-medium" style={{ color: "#1E40AF" }}>Uploading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F2" }}>
        <AlertCircle size={14} style={{ color: "#DC2626" }} />
        <span className="text-[11px] font-medium" style={{ color: "#991B1B" }}>{error}</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
      style={{
        borderColor: isDragging ? "#245C5A" : "#E2E8F0",
        backgroundColor: isDragging ? "#F0FDFA" : "#F8FAFC",
        borderStyle: isDragging ? "solid" : "dashed",
      }}
      title="Click or drag & drop to upload"
    >
      <Upload size={14} style={{ color: isDragging ? "#245C5A" : "#94A3B8" }} />
      <span className="text-[11px] font-medium" style={{ color: isDragging ? "#245C5A" : "#64748B" }}>
        {isDragging ? "Drop file" : "Upload"}
      </span>
      <input ref={inputRef} type="file" className="hidden" onChange={onChange} />
    </div>
  );
}
