import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { UserMinus } from "lucide-react";
export function SeparationManagementPage() {
  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#DC2626" }}>
            <UserMinus size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Separation Management</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Employee separation and offboarding</p>
          </div>
        </div>
        <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <p style={{ color: "var(--topbar-subtitle)" }}>Separation management module coming soon.</p>
        </div>
      </div>
    </AppShell>
  );
}
