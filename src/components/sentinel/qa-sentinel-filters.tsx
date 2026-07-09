import { Filter, Calendar, Building } from "lucide-react";

export function QASentinelFilters() {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
      <Filter size={14} style={{ color: "var(--topbar-subtitle)" }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Filters:</span>

      <div className="flex items-center gap-1 rounded border px-2 py-1" style={{ borderColor: "var(--card-border)" }}>
        <Calendar size={10} style={{ color: "var(--topbar-subtitle)" }} />
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Last 30 days</span>
      </div>

      <div className="flex items-center gap-1 rounded border px-2 py-1" style={{ borderColor: "var(--card-border)" }}>
        <Building size={10} style={{ color: "var(--topbar-subtitle)" }} />
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>All Facilities</span>
      </div>
    </div>
  );
}
