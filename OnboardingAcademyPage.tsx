import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { ClipboardCheck } from "lucide-react";

export function AuditPage() {
  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#D97706" }}>
            <ClipboardCheck size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Compliance & Audits</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Audit logs, compliance tracking, and inspections</p>
          </div>
        </div>
        <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <p style={{ color: "var(--topbar-subtitle)" }}>Compliance and audit module coming soon.</p>
        </div>
      </div>
    </AppShell>
  );
}
