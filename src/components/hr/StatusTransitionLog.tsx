import { History, User, ArrowRight, Clock, FileText } from "lucide-react";
import type { StatusTransition } from "@/context/HRContext";

interface Props {
  transitions: StatusTransition[];
}

export function StatusTransitionLog({ transitions }: Props) {
  if (transitions.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <History size={24} style={{ color: "#94A3B8" }} className="mx-auto mb-2" />
        <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
          No status transitions recorded yet
        </p>
        <p className="text-[11px] mt-1" style={{ color: "#94A3B8" }}>
          Changes will appear here when statuses are updated
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
        <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <History size={16} style={{ color: "#245C5A" }} />
          Status Transition Log
        </h3>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
          {transitions.length} entries
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
        {transitions.map((t) => (
          <div key={t.id} className="p-3">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
                  <User size={14} style={{ color: "#245C5A" }} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5 mb-1">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                    {t.moduleName}
                  </span>
                  <ArrowRight size={12} style={{ color: "#CBD5E1" }} />
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                    {t.fromStatus}
                  </span>
                  <ArrowRight size={12} style={{ color: "#CBD5E1" }} />
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                    {t.toStatus}
                  </span>
                </div>

                {t.note && (
                  <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: "#6B7280" }}>
                    <FileText size={11} />
                    {t.note}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px]" style={{ color: "#94A3B8" }}>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(t.changedAt)}
                  </span>
                  <span>by {t.changedBy}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
