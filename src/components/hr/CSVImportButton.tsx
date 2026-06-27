import { useState, useRef } from "react";
import { useHR } from "@/context/HRContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, AlertTriangle, CheckCircle, FileSpreadsheet } from "lucide-react";

interface Props {
  onImported?: () => void;
}

interface ImportRow {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  department: string;
  lane: "activation" | "management";
  supervisor: string;
  hireDate: string;
  isEmployee: boolean;
  errors: string[];
}

const EXPECTED_HEADERS = ["firstName", "lastName", "employeeId", "role", "department", "lane", "supervisor", "hireDate", "isEmployee"];
const REQUIRED_FIELDS = ["firstName", "lastName", "role", "department"];
const VALID_LANES = ["activation", "management"];

function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

    const lane = row.lane as "activation" | "management";
    const errors: string[] = [];

    for (const f of REQUIRED_FIELDS) {
      if (!row[f]?.trim()) errors.push(`${f} is required`);
    }
    if (row.lane && !VALID_LANES.includes(row.lane)) {
      errors.push(`lane must be "activation" or "management"`);
    }

    rows.push({
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      employeeId: row.employeeId || "",
      role: row.role || "",
      department: row.department || "",
      lane: lane || "activation",
      supervisor: row.supervisor || "",
      hireDate: row.hireDate || "",
      isEmployee: row.isEmployee?.toLowerCase() === "true" || row.isEmployee === "1" || !!row.hireDate,
      errors,
    });
  }

  return rows;
}

export function CSVImportButton({ onImported }: Props) {
  const { createPerson } = useHR();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [imported, setImported] = useState(0);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      const parsed = parseCSV(text);
      setRows(parsed);
      setDone(false);
      setImported(0);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    let count = 0;
    for (const row of rows) {
      if (row.errors.length > 0) continue;
      createPerson({
        firstName: row.firstName,
        lastName: row.lastName,
        employeeId: row.employeeId,
        role: row.role,
        department: row.department,
        lane: row.lane,
        supervisor: row.supervisor,
        hireDate: row.hireDate,
        isEmployee: row.isEmployee,
      });
      count++;
    }
    setImported(count);
    setDone(true);
    if (count > 0) onImported?.();
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-[11px] gap-1"
        onClick={() => { setOpen(true); setRows([]); setDone(false); }}
      >
        <Upload size={12} />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
              <FileSpreadsheet size={16} />
              Bulk Import People
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Upload */}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-all hover:border-[#245C5A] hover:bg-[#F0FDFA]"
              style={{ borderColor: "#CBD5E1" }}
            >
              <Upload size={18} style={{ color: "#245C5A" }} />
              <span className="text-[13px] font-medium" style={{ color: "#245C5A" }}>
                {rows.length > 0 ? "Choose a different file" : "Upload CSV file"}
              </span>
            </button>

            {/* Template hint */}
            {rows.length === 0 && (
              <div className="rounded-lg p-3 bg-gray-50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Required columns</p>
                <code className="text-[11px] text-gray-700">
                  {EXPECTED_HEADERS.join(", ")}
                </code>
                <p className="text-[10px] text-gray-500 mt-1">* Required: firstName, lastName, role, department</p>
              </div>
            )}

            {/* Preview */}
            {rows.length > 0 && !done && (
              <>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1" style={{ color: "#059669" }}>
                    <CheckCircle size={12} /> {validCount} valid
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1" style={{ color: "#DC2626" }}>
                      <AlertTriangle size={12} /> {errorCount} errors
                    </span>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-2 py-1.5 font-semibold">Name</th>
                        <th className="text-left px-2 py-1.5 font-semibold">Role</th>
                        <th className="text-left px-2 py-1.5 font-semibold">Dept</th>
                        <th className="text-left px-2 py-1.5 font-semibold">Lane</th>
                        <th className="text-left px-2 py-1.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">{r.firstName} {r.lastName}</td>
                          <td className="px-2 py-1.5">{r.role}</td>
                          <td className="px-2 py-1.5">{r.department}</td>
                          <td className="px-2 py-1.5">{r.lane}</td>
                          <td className="px-2 py-1.5">
                            {r.errors.length > 0 ? (
                              <span className="text-[9px]" style={{ color: "#DC2626" }}>{r.errors.join(", ")}</span>
                            ) : (
                              <CheckCircle size={12} style={{ color: "#059669" }} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Done state */}
            {done && (
              <div className="text-center py-6">
                <CheckCircle size={32} style={{ color: "#059669" }} className="mx-auto mb-2" />
                <p className="font-semibold text-[14px]" style={{ color: "#059669" }}>
                  {imported} people imported
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {rows.length - imported - errorCount === 0 ? "All rows processed." : `${rows.length - imported - errorCount} skipped`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-[11px]"
              onClick={() => setOpen(false)}
            >
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && validCount > 0 && (
              <Button
                size="sm"
                className="text-[11px] text-white"
                style={{ backgroundColor: "#059669" }}
                onClick={handleImport}
              >
                Import {validCount} People
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
