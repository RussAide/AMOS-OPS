import { useState, useRef, useCallback } from "react";
import { Upload, X, File, CheckCircle, AlertTriangle } from "lucide-react";

const ALLOWED_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/*": ["jpg", "jpeg", "png", "gif", "bmp"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadProps {
  onFileSelect: (file: { name: string; size: string; type: string; content: string }) => void;
  onClear?: () => void;
  value?: { name: string; size: string; type: string; content: string } | null;
}

export function FileUpload({ onFileSelect, onClear, value }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatSize(MAX_FILE_SIZE)} limit.`;
    }
    const isAllowed = Object.keys(ALLOWED_TYPES).some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.replace("/*", ""));
      }
      return file.type === type;
    });
    if (!isAllowed) {
      return "Invalid file type. Allowed: PDF, Word, Excel, Images, TXT.";
    }
    return null;
  }, []);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        onFileSelect({
          name: file.name,
          size: formatSize(file.size),
          type: file.type,
          content,
        });
      };
      reader.onerror = () => {
        setError("Failed to read file. Please try again.");
      };
      reader.readAsDataURL(file);
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = ""; // Reset so same file can be selected again
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    setError(null);
    onClear?.();
  }, [onClear]);

  // If a file is already uploaded, show preview
  if (value) {
    return (
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "#059669", backgroundColor: "#ECFDF5" }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle size={20} style={{ color: "#059669" }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: "#065F46" }}>
              {value.name}
            </p>
            <p className="text-[12px]" style={{ color: "#059669" }}>
              {value.size} • Ready for submission
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg transition-colors hover:bg-white"
            style={{ color: "#059669" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200"
        style={{
          borderColor: isDragOver ? "#245C5A" : error ? "#DC2626" : "#CBD5E1",
          backgroundColor: isDragOver ? "#F0FDFA" : error ? "#FEF2F2" : "#F8FAFC",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif"
        />
        <Upload
          size={32}
          className="mx-auto mb-3"
          style={{ color: isDragOver ? "#245C5A" : "#94A3B8" }}
        />
        <p className="text-[14px] font-medium mb-1" style={{ color: "var(--topbar-title)" }}>
          {isDragOver ? "Drop file here" : "Drag & drop a file, or click to browse"}
        </p>
        <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
          PDF, Word, Excel, Images, TXT up to {formatSize(MAX_FILE_SIZE)}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mt-3 p-3 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: "#FEE2E2" }}
        >
          <AlertTriangle size={16} style={{ color: "#DC2626" }} />
          <p className="text-[12px]" style={{ color: "#991B1B" }}>
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

// Download button for evidence files
interface FileDownloadButtonProps {
  fileName: string;
  fileContent?: string;
  fileSize: string;
}

export function FileDownloadButton({ fileName, fileContent, fileSize }: FileDownloadButtonProps) {
  const handleDownload = useCallback(() => {
    if (!fileContent) return;
    const a = document.createElement("a");
    a.href = fileContent;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [fileName, fileContent]);

  return (
    <button
      onClick={handleDownload}
      disabled={!fileContent}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
    >
      <File size={14} />
      {fileName} ({fileSize})
    </button>
  );
}
