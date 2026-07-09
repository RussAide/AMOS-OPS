import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, FileWarning, ChevronRight } from "lucide-react";

export function MissingFormsPanel() {
  const [open, setOpen] = useState(false);

  const { data: missing = [] } = trpc.forms.missingFormsReport.useQuery(
    undefined,
    { enabled: open }
  );

  const totalMissing = missing.reduce((sum, m) => sum + m.missingFormCount, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative p-3 rounded-lg border transition-all hover:shadow-md" style={{
          borderColor: totalMissing > 0 ? "#DC262630" : "#245C5A30",
          backgroundColor: totalMissing > 0 ? "#FEF2F208" : "#F0FDFA08",
        }}>
          {totalMissing > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>
              {totalMissing}
            </span>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Missing Forms</p>
              <p className="text-2xl font-bold mt-1" style={{ color: totalMissing > 0 ? "#DC2626" : "#059669" }}>
                {missing.length}
              </p>
            </div>
            <FileWarning size={20} style={{ color: totalMissing > 0 ? "#DC2626" : "#059669" }} />
          </div>
          {totalMissing > 0 && (
            <p className="text-[9px] mt-1" style={{ color: "#DC2626" }}>{totalMissing} forms missing</p>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#DC2626" }}>
            <AlertTriangle size={18} />
            Missing Forms Report
          </DialogTitle>
        </DialogHeader>

        {missing.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
              <FileWarning size={20} style={{ color: "#059669" }} />
            </div>
            <p className="font-semibold text-[13px]" style={{ color: "#059669" }}>All packets complete</p>
            <p className="text-[11px] text-muted-foreground">No missing forms found across all packets.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              {missing.length} packet{missing.length !== 1 ? "s" : ""} with missing forms · {totalMissing} total missing
            </p>

            {missing.map((m) => (
              <div key={m.packetId} className="border rounded-lg p-3" style={{ borderColor: "#FEE2E2", backgroundColor: "#FEF2F2" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                      {m.packetType.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Person: {m.personId.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: "#DC2626" }}>
                    {m.missingFormCount} missing
                  </span>
                </div>

                <div className="space-y-0.5">
                  {m.missingFormNames.map((name: string, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                      <ChevronRight size={10} style={{ color: "#DC2626" }} />
                      <span style={{ color: "var(--topbar-title)" }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
