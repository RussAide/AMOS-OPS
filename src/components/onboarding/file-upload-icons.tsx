import { File, FileSpreadsheet, FileText, Image } from "lucide-react";

export function getFileIcon(type: string) {
  if (type.includes("pdf")) return <File size={20} style={{ color: "#DC2626" }} />;
  if (type.includes("image")) return <Image size={20} style={{ color: "#2563EB" }} />;
  if (type.includes("word") || type.includes("document")) {
    return <FileText size={20} style={{ color: "#2563EB" }} />;
  }
  if (type.includes("sheet") || type.includes("excel")) {
    return <FileSpreadsheet size={20} style={{ color: "#059669" }} />;
  }
  return <File size={20} style={{ color: "#64748B" }} />;
}
