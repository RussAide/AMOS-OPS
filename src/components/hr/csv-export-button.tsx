import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  data: Record<string, string | number | boolean>[];
  filename?: string;
  label?: string;
}

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function CSVExportButton({ data, filename = "export.csv", label = "Export CSV" }: Props) {
  const handleExport = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => escapeCSV(row[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-[11px] gap-1"
      onClick={handleExport}
      disabled={data.length === 0}
    >
      <Download size={12} />
      {label}
    </Button>
  );
}
