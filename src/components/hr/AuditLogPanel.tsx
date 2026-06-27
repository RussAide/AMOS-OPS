import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Calendar, User, ArrowRight } from "lucide-react";

const ENTITY_COLORS: Record<string, { bg: string; color: string }> = {
  person: { bg: "#F0FDFA", color: "#245C5A" },
  document: { bg: "#EFF6FF", color: "#2563EB" },
  status: { bg: "#FFFBEB", color: "#D97706" },
  credential: { bg: "#F3E8FF", color: "#7C3AED" },
  review: { bg: "#ECFDF5", color: "#059669" },
  separation: { bg: "#FEF2F2", color: "#DC2626" },
};

export function AuditLogPanel() {
  const [open, setOpen] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [] } = trpc.audit.list.useQuery(
    entityFilter !== "all" || actionFilter !== "all"
      ? {
          entityType: entityFilter !== "all" ? entityFilter : undefined,
          action: actionFilter !== "all" ? actionFilter : undefined,
          limit: 200,
        }
      : { limit: 200 },
    { enabled: open }
  );

  const filtered = logs.filter((l) => {
    if (entityFilter !== "all" && l.entityType !== entityFilter) return false;
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#245C5A30", backgroundColor: "#F0FDFA08" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Audit Trail</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#245C5A" }}>{logs.length}</p>
            </div>
            <ClipboardList size={20} style={{ color: "#245C5A" }} />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <ClipboardList size={18} />
            Audit Log
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="person">Person</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="credential">Credential</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="separation">Separation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="status-change">Status Change</SelectItem>
              <SelectItem value="verify">Verify</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} entries</span>
        </div>

        {/* Log entries */}
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No audit entries found.</p>
          ) : (
            filtered.map((log) => {
              const style = ENTITY_COLORS[log.entityType] || { bg: "#F3F4F6", color: "#6B7280" };
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-2.5 rounded-md border"
                  style={{ borderColor: `${style.color}20`, backgroundColor: style.bg }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ backgroundColor: style.color + "15", color: style.color }}>
                        {log.entityType}
                      </span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/70 text-gray-500 font-medium">
                        {log.action}
                      </span>
                      <span className="text-[9px] text-muted-foreground ml-auto flex items-center gap-1">
                        <Calendar size={9} /> {log.performedAt?.slice(0, 10)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <User size={10} style={{ color: "#94A3B8" }} />
                      <span className="text-[10px] font-medium" style={{ color: "var(--topbar-title)" }}>
                        {log.performedBy}
                      </span>
                      <ArrowRight size={10} style={{ color: "#CBD5E1" }} />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {log.entityId}
                      </span>
                    </div>
                    {log.newValues && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                        {log.newValues.slice(0, 120)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
